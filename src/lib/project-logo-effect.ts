import { createProjectLogoRenderer, SWEEP_DURATION } from "./project-logo-renderer";

const FRAME_MS = 1000 / 24;

export function mountProjectLogoEffects(root: HTMLElement): (() => void) | undefined {
  const candidate = createProjectLogoRenderer();
  if (!candidate) {
    return undefined;
  }
  const renderer = candidate;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const hover = matchMedia("(hover: hover) and (pointer: fine)");
  const entries = new Map<
    HTMLElement,
    {
      image: HTMLImageElement;
      outline: CanvasRenderingContext2D;
      crt: CanvasRenderingContext2D;
      texture: WebGLTexture | null;
      card: HTMLElement;
      visible: boolean;
      started: number | null;
      elapsed: number;
      enter: () => void;
      leave: () => void;
    }
  >();
  let frame = 0;
  let lastPaint = -Infinity;
  let disposed = false;

  function schedule() {
    if (!disposed && !document.hidden && !frame) {
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    frame = 0;
    if (now - lastPaint < FRAME_MS) {
      schedule();
      return;
    }
    lastPaint = now;
    let pending = false;
    for (const [element, entry] of entries) {
      if (!entry.visible || !entry.image.complete || !entry.image.naturalWidth) {
        continue;
      }
      if (!element.hasAttribute("data-ready")) {
        entry.texture ??= renderer.upload(entry.image);
        if (renderer.draw(entry.texture, entry.outline, null)) {
          element.dataset.ready = "";
        }
      }
      if (
        !entry.texture ||
        entry.started === null ||
        (reducedMotion.matches && entry.elapsed === SWEEP_DURATION)
      ) {
        continue;
      }
      entry.elapsed = reducedMotion.matches
        ? SWEEP_DURATION
        : (now - entry.started) % SWEEP_DURATION;
      if (renderer.draw(entry.texture, entry.crt, entry.elapsed)) {
        if (!element.hasAttribute("data-crt")) {
          element.dataset.crt = "";
        }
      }
      pending ||= !reducedMotion.matches;
    }
    if (pending) {
      schedule();
    }
  }

  const observer = new IntersectionObserver((changes) => {
    for (const change of changes) {
      const entry = entries.get(change.target as HTMLElement);
      if (entry) {
        entry.visible = change.isIntersecting;
        if (!entry.visible) {
          entry.leave();
        } else if (entry.card.matches(":hover")) {
          entry.enter();
        }
      }
    }
    schedule();
  });
  function removeEntry(element: HTMLElement) {
    const entry = entries.get(element)!;
    observer.unobserve(element);
    entry.image.removeEventListener("load", schedule);
    entry.card.removeEventListener("pointerenter", entry.enter);
    entry.card.removeEventListener("pointerleave", entry.leave);
    if (entry.texture) {
      renderer.deleteTexture(entry.texture);
    }
    delete element.dataset.ready;
    delete element.dataset.crt;
    entries.delete(element);
  }
  function syncEntries() {
    for (const element of entries.keys()) {
      if (!root.contains(element)) {
        removeEntry(element);
      }
    }
    for (const element of root.querySelectorAll<HTMLElement>("[data-project-logo]")) {
      if (entries.has(element)) {
        continue;
      }
      const image = element.querySelector("img");
      const outline = element
        .querySelector<HTMLCanvasElement>("[data-logo-outline]")
        ?.getContext("2d");
      const crt = element.querySelector<HTMLCanvasElement>("[data-logo-crt]")?.getContext("2d");
      const card = element.closest<HTMLElement>(".project-card");
      if (!image || !outline || !crt || !card) {
        continue;
      }
      const entry = {
        image,
        outline,
        crt,
        card,
        texture: null as WebGLTexture | null,
        visible: false,
        started: null as number | null,
        elapsed: SWEEP_DURATION,
        enter: () => {
          if (disposed || !hover.matches || entry.started !== null) {
            return;
          }
          entry.started = performance.now();
          entry.elapsed = -1;
          schedule();
        },
        leave: () => {
          entry.started = null;
          delete element.dataset.crt;
        },
      };
      entries.set(element, entry);
      image.addEventListener("load", schedule);
      card.addEventListener("pointerenter", entry.enter);
      card.addEventListener("pointerleave", entry.leave);
      observer.observe(element);
    }
  }
  syncEntries();
  const mutations = new MutationObserver(syncEntries);
  mutations.observe(root, { childList: true, subtree: true });
  function onVisibility() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (document.hidden) {
      entries.forEach((entry) => entry.leave());
    } else {
      entries.forEach((entry) => {
        if (entry.visible && entry.card.matches(":hover")) {
          entry.enter();
        }
      });
      schedule();
    }
  }
  function onHoverChange() {
    entries.forEach((entry) => entry.leave());
  }
  function onContextLost(event: Event) {
    event.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    disposed = true;
    entries.forEach((entry) => entry.leave());
  }
  renderer.canvas.addEventListener("webglcontextlost", onContextLost);
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", schedule);
  hover.addEventListener("change", onHoverChange);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    mutations.disconnect();
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", schedule);
    hover.removeEventListener("change", onHoverChange);
    renderer.canvas.removeEventListener("webglcontextlost", onContextLost);
    for (const element of entries.keys()) {
      removeEntry(element);
    }
    renderer.dispose();
  };
}
