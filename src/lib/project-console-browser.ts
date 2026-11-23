import { normalizeSearchText, searchTerms } from "./search-text";

type ProjectSearchEntry = {
  id: string;
  filters: string[];
  name: string;
  kind: string;
  description: string;
  tags: string[];
};

type PillBox = { x: number; y: number; width: number; height: number };

const initializedRoots = new WeakSet<HTMLElement>();

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isDesktopViewport(): boolean {
  return (
    typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1024px)").matches
  );
}

function getCssEasing(token: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function rankEntries(entries: ProjectSearchEntry[], query: string): ProjectSearchEntry[] {
  const terms = searchTerms(query);
  if (terms.length === 0) {
    return entries;
  }
  return entries
    .map((entry, index) => {
      const termScores = terms.map((term) => {
        const nameBoost = entry.name.includes(term) ? 8 : 0;
        const tagBoost = entry.tags.some((tag) => tag.includes(term)) ? 5 : 0;
        const kindBoost = entry.kind.includes(term) ? 3 : 0;
        const descriptionBoost = entry.description.includes(term) ? 1 : 0;
        return nameBoost + tagBoost + kindBoost + descriptionBoost;
      });
      return {
        entry,
        index,
        matched: termScores.every((score) => score > 0),
        score: termScores.reduce((sum, score) => sum + score, 0),
      };
    })
    .filter((result) => result.matched)
    .toSorted((left, right) => right.score - left.score || left.index - right.index)
    .map((result) => result.entry);
}

function measureBox(element: HTMLElement, track: HTMLElement): PillBox | null {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  const trackRect = track.getBoundingClientRect();
  return {
    x: rect.left - trackRect.left + track.scrollLeft,
    y: rect.top - trackRect.top + track.scrollTop,
    width: rect.width,
    height: rect.height,
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function mountFilterPill(track: HTMLElement): {
  sync: (animate: boolean) => void;
  destroy: () => void;
} {
  const pill = track.querySelector<HTMLElement>("[data-project-filter-pill]");
  if (!pill) {
    return { sync: () => {}, destroy: () => {} };
  }
  track.setAttribute("data-pill-ready", "");
  let currentAnim: Animation | null = null;
  let currentBox: PillBox | null = null;

  const applyBox = (box: PillBox | null) => {
    currentBox = box;
    if (!box) {
      pill.style.opacity = "0";
      return;
    }
    pill.style.width = `${box.width}px`;
    pill.style.height = `${box.height}px`;
    pill.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
    pill.style.opacity = "1";
  };

  const sync = (animate: boolean) => {
    const pressed = track.querySelector<HTMLElement>('[data-project-filter][aria-pressed="true"]');
    const nextBox = pressed ? measureBox(pressed, track) : null;
    let startBox = currentBox;
    if (currentAnim) {
      const liveBox = measureBox(pill, track);
      if (liveBox) {
        startBox = liveBox;
      }
      currentAnim.cancel();
      currentAnim = null;
    }
    applyBox(nextBox);
    if (
      !animate ||
      !nextBox ||
      !startBox ||
      typeof pill.animate !== "function" ||
      prefersReducedMotion()
    ) {
      return;
    }
    if (
      Math.abs(startBox.x - nextBox.x) < 0.5 &&
      Math.abs(startBox.y - nextBox.y) < 0.5 &&
      Math.abs(startBox.width - nextBox.width) < 0.5
    ) {
      return;
    }
    const duration = isDesktopViewport() ? 170 : 250;
    const easing = getCssEasing("--ease-in-out", "cubic-bezier(0.77, 0, 0.175, 1)");
    const movingRight = nextBox.x >= startBox.x;
    const midLeft = movingRight
      ? lerp(startBox.x, nextBox.x, 0.22)
      : lerp(startBox.x, nextBox.x, 0.82);
    const midRight = movingRight
      ? lerp(startBox.x + startBox.width, nextBox.x + nextBox.width, 0.82)
      : lerp(startBox.x + startBox.width, nextBox.x + nextBox.width, 0.22);
    const anim = pill.animate(
      [
        {
          width: `${startBox.width}px`,
          height: `${startBox.height}px`,
          transform: `translate3d(${startBox.x}px, ${startBox.y}px, 0) scaleY(1)`,
        },
        {
          offset: 0.42,
          width: `${Math.max(8, midRight - midLeft)}px`,
          height: `${lerp(startBox.height, nextBox.height, 0.5)}px`,
          transform: `translate3d(${midLeft}px, ${lerp(startBox.y, nextBox.y, 0.5)}px, 0) scaleY(0.85)`,
        },
        {
          width: `${nextBox.width}px`,
          height: `${nextBox.height}px`,
          transform: `translate3d(${nextBox.x}px, ${nextBox.y}px, 0) scaleY(1)`,
        },
      ],
      { duration, easing },
    );
    currentAnim = anim;
    void anim.finished
      .catch(() => {})
      .finally(() => {
        if (currentAnim === anim) {
          currentAnim = null;
        }
      });
  };

  const resizeObserver =
    typeof ResizeObserver === "function" ? new ResizeObserver(() => sync(false)) : null;
  resizeObserver?.observe(track);
  sync(false);

  return {
    sync,
    destroy: () => {
      currentAnim?.cancel();
      resizeObserver?.disconnect();
    },
  };
}

export function initializeProjectConsole(root: HTMLElement): () => void {
  if (initializedRoots.has(root)) {
    return () => {};
  }
  initializedRoots.add(root);

  const dataScript = root.querySelector<HTMLScriptElement>("script[data-project-console-data]");
  const rawEntries = dataScript?.textContent
    ? (JSON.parse(dataScript.textContent) as Array<{
        id: string;
        filters: string[];
        name: string;
        kind: string;
        description: string;
        tags: string[];
      }>)
    : [];
  const entries: ProjectSearchEntry[] = rawEntries.map((entry) => ({
    id: entry.id,
    filters: entry.filters,
    name: normalizeSearchText(entry.name),
    kind: normalizeSearchText(entry.kind),
    description: normalizeSearchText(entry.description),
    tags: entry.tags.map(normalizeSearchText),
  }));

  const grid = root.querySelector<HTMLElement>("[data-project-grid]");
  const empty = root.querySelector<HTMLElement>("[data-project-empty]");
  const liveStatus = root.querySelector<HTMLElement>("[data-project-live]");
  const searchInput = root.querySelector<HTMLInputElement>("[data-project-search]");
  const clearButton = root.querySelector<HTMLButtonElement>("[data-project-clear]");
  const filterTrack = root.querySelector<HTMLElement>("[data-project-filter-track]");
  const filterButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-project-filter]")];
  const cards = new Map<string, HTMLElement>();
  for (const card of root.querySelectorAll<HTMLElement>("[data-project-card]")) {
    const id = card.dataset.projectCard;
    if (id) {
      cards.set(id, card);
    }
  }

  const showingTemplate = root.dataset.showingTemplate ?? "";
  const totalCount = entries.length;
  const controller = new AbortController();
  const { signal } = controller;
  const pill = filterTrack ? mountFilterPill(filterTrack) : null;
  const cardAnimations = new Map<string, Animation>();

  let activeFilter = "all";
  let query = "";

  // 卡片背景图平时 opacity: 0，仅在悬停或聚焦时才赋值 src 触发下载。
  const hydrateCardArt = (card: Element | null) => {
    const img = card?.querySelector<HTMLImageElement>("img.project-card-art[data-src]");
    if (img?.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    }
  };
  root.addEventListener(
    "pointerover",
    (event) => {
      if (event.target instanceof Element) {
        hydrateCardArt(event.target.closest("[data-project-card]"));
      }
    },
    { passive: true, signal },
  );
  root.addEventListener(
    "focusin",
    (event) => {
      if (event.target instanceof Element) {
        hydrateCardArt(event.target.closest("[data-project-card]"));
      }
    },
    { signal },
  );

  const cancelCardAnimations = () => {
    for (const anim of cardAnimations.values()) {
      anim.cancel();
    }
    cardAnimations.clear();
  };

  const applyView = () => {
    const prevRects = new Map<string, DOMRect>();
    for (const [id, element] of cards) {
      if (!element.hidden) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          prevRects.set(id, rect);
        }
      }
    }

    cancelCardAnimations();

    const filtered = rankEntries(entries, query).filter(
      (entry) => activeFilter === "all" || entry.filters.includes(activeFilter),
    );
    const visibleIds = new Set(filtered.map((entry) => entry.id));

    if (grid) {
      for (const [id, card] of cards) {
        card.hidden = !visibleIds.has(id);
      }
      filtered.forEach((entry, index) => {
        const card = cards.get(entry.id);
        if (card) {
          card.dataset.column = String((index % 4) + 1);
          grid.append(card);
        }
      });
      grid.hidden = filtered.length === 0;
    }
    if (empty) {
      empty.hidden = filtered.length > 0;
    }
    if (clearButton) {
      clearButton.hidden = query.length === 0;
    }
    if (liveStatus && showingTemplate) {
      liveStatus.textContent = showingTemplate
        .replace("{shown}", String(filtered.length))
        .replace("{total}", String(totalCount));
    }

    const reducedMotion = prefersReducedMotion();
    const duration = isDesktopViewport() ? 190 : 280;
    const easing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");

    for (const entry of filtered) {
      const element = cards.get(entry.id);
      if (!element || typeof element.animate !== "function") {
        continue;
      }
      const nextRect = element.getBoundingClientRect();
      if (nextRect.width <= 0 || nextRect.height <= 0) {
        continue;
      }
      const prevRect = prevRects.get(entry.id);
      let anim: Animation | null = null;
      if (prevRect) {
        if (reducedMotion) {
          continue;
        }
        const dx = prevRect.left - nextRect.left;
        const dy = prevRect.top - nextRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          continue;
        }
        anim = element.animate(
          [
            { transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          { duration, easing },
        );
      } else {
        anim = element.animate(
          reducedMotion
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                { opacity: 0, transform: "translate3d(0, 8px, 0) scale(0.985)" },
                { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
              ],
          { duration: reducedMotion ? 150 : duration, easing },
        );
      }
      cardAnimations.set(entry.id, anim);
      const currentAnim = anim;
      void currentAnim.finished
        .catch(() => {})
        .finally(() => {
          if (cardAnimations.get(entry.id) === currentAnim) {
            cardAnimations.delete(entry.id);
          }
        });
    }
  };

  for (const button of filterButtons) {
    button.addEventListener(
      "click",
      () => {
        const nextFilter = button.dataset.projectFilter ?? "all";
        if (nextFilter === activeFilter) {
          return;
        }
        activeFilter = nextFilter;
        for (const candidate of filterButtons) {
          candidate.setAttribute(
            "aria-pressed",
            String(candidate.dataset.projectFilter === activeFilter),
          );
        }
        pill?.sync(true);
        applyView();
      },
      { signal },
    );
  }

  searchInput?.addEventListener(
    "input",
    () => {
      if (searchInput.value === query) {
        return;
      }
      query = searchInput.value;
      applyView();
    },
    { signal },
  );

  clearButton?.addEventListener(
    "click",
    () => {
      if (!searchInput) {
        return;
      }
      searchInput.value = "";
      query = "";
      applyView();
      searchInput.focus();
    },
    { signal },
  );

  // WebGL Logo 描边与 CRT 悬停特效在首屏空闲后按需加载，不阻塞首次绘制与交互。
  let disposeLogos: (() => void) | undefined;
  let idleId = 0;
  let disposed = false;
  const startLogos = () => {
    if (disposed || !root.isConnected) {
      return;
    }
    void import("@/lib/project-logo/effect").then(({ mountProjectLogoEffects }) => {
      if (disposed || !root.isConnected) {
        return;
      }
      disposeLogos = mountProjectLogoEffects(root);
    });
  };
  if (typeof window.requestIdleCallback === "function") {
    idleId = window.requestIdleCallback(startLogos, { timeout: 1500 });
  } else {
    idleId = Number(globalThis.setTimeout(startLogos, 150));
  }

  return () => {
    disposed = true;
    if (typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleId);
    } else {
      clearTimeout(idleId);
    }
    disposeLogos?.();
    cancelCardAnimations();
    pill?.destroy();
    controller.abort();
  };
}
