export class ContactPreview extends HTMLElement {
  private cleanup?: () => void;

  connectedCallback() {
    this.cleanup?.();
    const trigger = this.querySelector<HTMLAnchorElement>("[data-contact-trigger]")!;
    const popup = this.querySelector<HTMLElement>("[popover]")!;
    const surface = this.querySelector<HTMLAnchorElement>(".contact-surface")!;
    if (!popup.showPopover) {
      return;
    }

    const events = new AbortController();
    const options = { signal: events.signal };
    const hover = matchMedia("(hover: hover) and (pointer: fine)");
    const motion = matchMedia("(prefers-reduced-motion: no-preference)");
    let pendingTimer = 0;
    let frame = 0;
    let previousTime = 0;
    let bounds: DOMRect;
    const current = { x: 0.5, y: 0.5, light: 0 };
    const target = { ...current };
    const isOpen = () => popup.matches(":popover-open");
    const cancelPending = () => window.clearTimeout(pendingTimer);

    function paint() {
      surface.style.setProperty("--tilt-x", `${(0.5 - current.y) * 8}deg`);
      surface.style.setProperty("--tilt-y", `${(current.x - 0.5) * 8}deg`);
      surface.style.setProperty("--pointer-x", `${current.x * 100}%`);
      surface.style.setProperty("--pointer-y", `${current.y * 100}%`);
      surface.style.setProperty("--sheen", String(current.light));
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      Object.assign(current, { x: 0.5, y: 0.5, light: 0 });
      Object.assign(target, current);
      paint();
    }

    function animate(time: number) {
      const blend = 1 - Math.exp(-Math.min(time - previousTime, 64) / 80);
      previousTime = time;
      current.x += (target.x - current.x) * blend;
      current.y += (target.y - current.y) * blend;
      current.light += (target.light - current.light) * blend;
      const settled =
        Math.abs(target.x - current.x) +
          Math.abs(target.y - current.y) +
          Math.abs(target.light - current.light) <
        0.001;
      if (settled) {
        Object.assign(current, target);
      }
      paint();
      frame = settled ? 0 : requestAnimationFrame(animate);
    }

    function startMotion() {
      if (!frame) {
        previousTime = performance.now();
        frame = requestAnimationFrame(animate);
      }
    }

    function close() {
      cancelPending();
      if (isOpen()) {
        popup.hidePopover();
      }
    }

    function place() {
      if (!isOpen()) {
        return;
      }
      const anchor = trigger.getBoundingClientRect();
      if (anchor.bottom < 0 || anchor.top > innerHeight) {
        close();
        return;
      }
      const { width, height } = popup.getBoundingClientRect();
      const gap = 4;
      const edge = 12;
      let side = "top";
      let left = anchor.left - 8;
      let top = anchor.top - height - gap;
      if (anchor.left >= width + gap + edge) {
        side = "left";
        left = anchor.left - width - gap;
        top = anchor.top + (anchor.height - height) / 2;
      } else if (top < edge && anchor.bottom + gap + height <= innerHeight - edge) {
        side = "bottom";
        top = anchor.bottom + gap;
      }
      popup.dataset.side = side;
      popup.style.left = `${Math.max(edge, Math.min(left, innerWidth - width - edge))}px`;
      popup.style.top = `${Math.max(edge, Math.min(top, innerHeight - height - edge))}px`;
      // Measure the fixed hit area, not the surface that moves under the pointer.
      bounds = popup.getBoundingClientRect();
    }

    function open(keyboard = false) {
      cancelPending();
      if (isOpen()) {
        return;
      }
      popup.toggleAttribute("data-keyboard", keyboard);
      if (keyboard) {
        trigger.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
      popup.showPopover({ source: trigger });
      place();
    }

    const scheduleClose = () => {
      cancelPending();
      if (
        this.contains(document.activeElement) &&
        document.activeElement?.matches(":focus-visible")
      ) {
        return;
      }
      pendingTimer = window.setTimeout(close, 240);
    };

    this.addEventListener(
      "pointerenter",
      (event) => {
        if (hover.matches && event.pointerType === "mouse") {
          open();
        }
      },
      options,
    );
    this.addEventListener("pointerleave", scheduleClose, options);
    this.addEventListener(
      "focusin",
      (event) => {
        cancelPending();
        if (event.target instanceof Element && event.target.matches(":focus-visible")) {
          popup.setAttribute("data-keyboard", "");
          reset();
        }
        if (
          event.target === trigger &&
          trigger.matches(":focus-visible") &&
          !(event.relatedTarget instanceof Node && popup.contains(event.relatedTarget))
        ) {
          pendingTimer = window.setTimeout(() => open(true), 0);
        }
      },
      options,
    );
    this.addEventListener(
      "focusout",
      () => {
        // Let focus settle so hiding the popover cannot restore the previous trigger.
        cancelPending();
        pendingTimer = window.setTimeout(() => {
          if (!this.contains(document.activeElement)) {
            close();
          }
        }, 0);
      },
      options,
    );
    popup.addEventListener("pointerenter", cancelPending, options);
    popup.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          trigger.focus({ preventScroll: true });
          close();
        }
      },
      options,
    );
    popup.addEventListener(
      "pointerleave",
      () => {
        Object.assign(target, { x: 0.5, y: 0.5, light: 0 });
        if (motion.matches && hover.matches) {
          startMotion();
        }
        scheduleClose();
      },
      options,
    );
    popup.addEventListener(
      "pointermove",
      (event) => {
        if (!isOpen() || !hover.matches || !motion.matches || event.pointerType !== "mouse") {
          return;
        }
        popup.removeAttribute("data-keyboard");
        target.x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        target.y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
        target.light = 1;
        startMotion();
      },
      options,
    );
    popup.addEventListener(
      "beforetoggle",
      (event) => {
        trigger.setAttribute("aria-expanded", String(event.newState === "open"));
        if (event.newState === "closed") {
          cancelPending();
          reset();
        }
      },
      options,
    );
    window.addEventListener("scroll", place, { ...options, passive: true, capture: true });
    window.addEventListener("resize", place, options);
    window.addEventListener("blur", close, options);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          close();
        }
      },
      options,
    );
    hover.addEventListener("change", close, options);
    motion.addEventListener("change", reset, options);
    trigger.setAttribute("aria-expanded", "false");

    this.cleanup = () => {
      close();
      reset();
      events.abort();
    };
  }

  disconnectedCallback() {
    this.cleanup?.();
  }
}
