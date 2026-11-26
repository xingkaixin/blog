import { HIGHLIGHT_ATTR } from "@/lib/article-highlights";
import { htmlLang, type Locale } from "@/lib/i18n";
import { postsMessages } from "@/lib/messages/posts";
import type { TocItem } from "@/lib/post-toc";
import { POST_CONTENT_CHANGED_EVENT } from "@/lib/site-events";

export type PostContentSnapshot = {
  lang: Locale;
  highlightPath: string;
  title: string;
  summary: string;
  wordCountText: string;
  readingMinutesText: string;
  proseHtml: string;
  tocItems: TocItem[];
};

export type PostContentChangedDetail = {
  lang: Locale;
  highlightPath: string;
  title: string;
  tocItems: TocItem[];
};

const EASE_SMOOTH_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EXIT_MS = 120;
const ENTER_MS = 230;
const REDUCED_EXIT_MS = 90;
const REDUCED_ENTER_MS = 150;

const originalCache = new Map<string, Promise<PostContentSnapshot>>();

export function stripEnhancedProse(prose: HTMLElement): string {
  const clone = prose.cloneNode(true) as HTMLElement;

  for (const shell of clone.querySelectorAll<HTMLElement>(".code-block-shell")) {
    const pre = shell.querySelector("pre");
    if (pre) {
      shell.replaceWith(pre);
    }
  }

  for (const anchor of clone.querySelectorAll("[data-heading-anchor]")) {
    anchor.remove();
  }

  const touchedParents = new Set<Node>();
  for (const mark of clone.querySelectorAll<HTMLElement>(`mark[${HIGHLIGHT_ATTR}]`)) {
    if (mark.parentNode) {
      touchedParents.add(mark.parentNode);
    }
    mark.replaceWith(...mark.childNodes);
  }
  for (const parent of touchedParents) {
    parent.normalize();
  }

  for (const img of clone.querySelectorAll<HTMLImageElement>("img[data-zoomable]")) {
    img.removeAttribute("data-zoomable");
    img.removeAttribute("tabindex");
    img.removeAttribute("role");
    img.removeAttribute("aria-label");
  }

  return clone.innerHTML;
}

export function extractTocItems(root: ParentNode): TocItem[] {
  const items: TocItem[] = [];
  for (const link of root.querySelectorAll<HTMLElement>("[data-toc-track] [data-toc-link]")) {
    const id = link.getAttribute("data-toc-link")?.trim() ?? "";
    const text = link.textContent?.trim() ?? "";
    if (!id || !text) {
      continue;
    }
    const depth = link.getAttribute("data-toc-depth") === "3" ? 3 : 2;
    items.push({ id, text, depth });
  }
  return items;
}

export function captureCurrentPostSnapshot(
  doc: Document,
  lang: Locale,
  highlightPath: string,
): PostContentSnapshot | null {
  const titleEl = doc.querySelector<HTMLElement>("[data-post-title]");
  const summaryEl = doc.querySelector<HTMLElement>("[data-post-summary]");
  const proseEl = doc.querySelector<HTMLElement>("[data-quote-scope]");
  if (!titleEl || !summaryEl || !proseEl) {
    return null;
  }
  const wordCountEl = doc.querySelector<HTMLElement>("[data-post-word-count]");
  const minutesEl = doc.querySelector<HTMLElement>("[data-post-reading-minutes]");

  return {
    lang,
    highlightPath,
    title: titleEl.textContent?.trim() ?? "",
    summary: summaryEl.textContent?.trim() ?? "",
    wordCountText: wordCountEl?.textContent?.trim() ?? "",
    readingMinutesText: minutesEl?.textContent?.trim() ?? "",
    proseHtml: stripEnhancedProse(proseEl),
    tocItems: extractTocItems(doc),
  };
}

export function parseOriginalPostHtml(
  html: string,
  originalPath: string,
  uiLocale: Locale = "en",
): PostContentSnapshot | null {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const titleEl = parsed.querySelector<HTMLElement>("[data-post-title]");
  const summaryEl = parsed.querySelector<HTMLElement>("[data-post-summary]");
  const proseEl = parsed.querySelector<HTMLElement>("[data-quote-scope]");
  if (!titleEl || !summaryEl || !proseEl) {
    return null;
  }

  const t = postsMessages[uiLocale].detail;
  const wordCountEl = parsed.querySelector<HTMLElement>("[data-post-word-count]");
  const minutesEl = parsed.querySelector<HTMLElement>("[data-post-reading-minutes]");
  const rawWordCount = Number(wordCountEl?.dataset.wordCount);
  const rawMinutes = Number(minutesEl?.dataset.readingMinutes);

  const wordCountText =
    Number.isFinite(rawWordCount) && rawWordCount > 0
      ? t.charCount(rawWordCount)
      : (wordCountEl?.textContent?.trim() ?? "");
  const readingMinutesText =
    Number.isFinite(rawMinutes) && rawMinutes > 0
      ? t.readingMinutes(rawMinutes)
      : (minutesEl?.textContent?.trim() ?? "");

  return {
    lang: "zh",
    highlightPath: originalPath,
    title: titleEl.textContent?.trim() ?? "",
    summary: summaryEl.textContent?.trim() ?? "",
    wordCountText,
    readingMinutesText,
    proseHtml: proseEl.innerHTML,
    tocItems: extractTocItems(parsed),
  };
}

async function fetchOriginalSnapshot(
  originalHref: string,
  uiLocale: Locale,
  fetcher: typeof fetch,
): Promise<PostContentSnapshot> {
  const cached = originalCache.get(originalHref);
  if (cached) {
    return cached;
  }
  const pending = (async () => {
    const response = await fetcher(originalHref, {
      headers: { Accept: "text/html" },
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch original post (${response.status})`);
    }
    const html = await response.text();
    const snapshot = parseOriginalPostHtml(html, originalHref, uiLocale);
    if (!snapshot) {
      throw new Error("Original post HTML missing expected article elements");
    }
    return snapshot;
  })();

  originalCache.set(originalHref, pending);
  pending.catch(() => {
    if (originalCache.get(originalHref) === pending) {
      originalCache.delete(originalHref);
    }
  });
  return pending;
}

export function clearOriginalSnapshotCache(): void {
  originalCache.clear();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isUnmodifiedPrimaryClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function attachPostOriginalSwitch(
  doc: Document = document,
  fetcher: typeof fetch = fetch,
): () => void {
  const notice = doc.querySelector<HTMLElement>("[data-post-original-switch]");
  if (!notice) {
    return () => {};
  }

  const originalHref = notice.dataset.originalHref ?? "";
  const currentHref = notice.dataset.currentHref ?? "";
  if (!originalHref || !currentHref) {
    return () => {};
  }

  const uiLocale: Locale = notice.dataset.uiLocale === "zh" ? "zh" : "en";
  const t = postsMessages[uiLocale].detail;

  const titleEl = doc.querySelector<HTMLElement>("[data-post-title]");
  const summaryEl = doc.querySelector<HTMLElement>("[data-post-summary]");
  const wordCountEl = doc.querySelector<HTMLElement>("[data-post-word-count]");
  const minutesEl = doc.querySelector<HTMLElement>("[data-post-reading-minutes]");
  const proseEl = doc.querySelector<HTMLElement>("[data-quote-scope]");
  if (!titleEl || !summaryEl || !proseEl) {
    return () => {};
  }

  const badgeEl = notice.querySelector<HTMLElement>("[data-translation-badge]");
  const statusEl = notice.querySelector<HTMLElement>("[data-translation-status]");
  const segmentedEl = notice.querySelector<HTMLElement>("[data-lang-segmented]");
  const segButtons = Array.from(
    notice.querySelectorAll<HTMLButtonElement>("[data-content-lang-target]"),
  );
  const metaLink = doc.querySelector<HTMLAnchorElement>("[data-original-toggle-link]");

  const englishSnapshot = captureCurrentPostSnapshot(doc, "en", currentHref);
  if (!englishSnapshot) {
    return () => {};
  }

  const controller = new AbortController();
  const { signal } = controller;
  let activeLang: Locale = "en";
  let transitionToken = 0;
  let activeAnimations: Animation[] = [];

  const cancelAnimations = () => {
    for (const animation of activeAnimations) {
      try {
        animation.cancel();
      } catch {
        // Ignore already-finished animations
      }
    }
    activeAnimations = [];
  };

  const track = (animation: Animation): Promise<unknown> => {
    activeAnimations.push(animation);
    return animation.finished.catch(() => {});
  };

  const syncControlState = (lang: Locale, statusOverride?: string) => {
    notice.dataset.contentLang = lang;
    if (segmentedEl) {
      segmentedEl.dataset.active = lang;
    }
    for (const button of segButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.contentLangTarget === lang));
    }
    if (badgeEl) {
      badgeEl.textContent = lang === "zh" ? t.originalContentBadge : t.aiTranslationBadge;
    }
    if (statusEl) {
      statusEl.textContent =
        statusOverride ?? (lang === "zh" ? t.originalContentNotice : t.aiTranslationNotice);
    }
    if (metaLink) {
      metaLink.textContent = lang === "zh" ? t.backToEnglishAi : t.switchToChineseOriginal;
      metaLink.setAttribute("aria-pressed", String(lang === "zh"));
    }
  };

  const applySnapshot = (snapshot: PostContentSnapshot) => {
    const contentLangAttr = htmlLang[snapshot.lang];
    titleEl.textContent = snapshot.title;
    titleEl.lang = contentLangAttr;
    summaryEl.textContent = snapshot.summary;
    summaryEl.lang = contentLangAttr;
    if (wordCountEl) {
      wordCountEl.textContent = snapshot.wordCountText;
    }
    if (minutesEl) {
      minutesEl.textContent = snapshot.readingMinutesText;
    }

    const breadcrumbCurrent = doc.querySelector<HTMLElement>("[data-breadcrumb-current]");
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = snapshot.title;
    }
    const compactTitle = doc.querySelector<HTMLElement>("[data-compact-title]");
    if (compactTitle) {
      compactTitle.textContent = snapshot.title;
    }
    const copyrightTitle = doc.querySelector<HTMLElement>("[data-copyright-title]");
    if (copyrightTitle) {
      copyrightTitle.textContent = snapshot.title;
    }

    proseEl.innerHTML = snapshot.proseHtml;
    proseEl.lang = contentLangAttr;
    proseEl.dataset.highlightPath = snapshot.highlightPath;

    const detail: PostContentChangedDetail = {
      lang: snapshot.lang,
      highlightPath: snapshot.highlightPath,
      title: snapshot.title,
      tocItems: snapshot.tocItems,
    };
    doc.dispatchEvent(
      new CustomEvent<PostContentChangedDetail>(POST_CONTENT_CHANGED_EVENT, { detail }),
    );
  };

  const animationTargets = (): {
    all: HTMLElement[];
    staggered: { el: HTMLElement; delay: number }[];
  } => {
    const tocTrack = doc.querySelector<HTMLElement>("[data-toc-track]");
    const tocVisible = tocTrack && !tocTrack.hidden ? tocTrack : null;
    const all = [titleEl, summaryEl, proseEl, ...(tocVisible ? [tocVisible] : [])];
    const staggered: { el: HTMLElement; delay: number }[] = [
      { el: titleEl, delay: 0 },
      { el: summaryEl, delay: 25 },
      ...(tocVisible ? [{ el: tocVisible, delay: 35 }] : []),
      { el: proseEl, delay: 45 },
    ];
    return { all, staggered };
  };

  const transitionToSnapshot = async (snapshot: PostContentSnapshot, token: number) => {
    const { all, staggered } = animationTargets();
    const canAnimate = typeof proseEl.animate === "function";
    if (!canAnimate) {
      applySnapshot(snapshot);
      return;
    }

    const reduced = prefersReducedMotion();
    if (reduced) {
      await Promise.all(
        all.map((el) =>
          track(
            el.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: REDUCED_EXIT_MS,
              easing: EASE_SMOOTH_OUT,
              fill: "forwards",
            }),
          ),
        ),
      );
      if (token !== transitionToken || signal.aborted) {
        return;
      }
      applySnapshot(snapshot);
      await Promise.all(
        all.map((el) =>
          track(
            el.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: REDUCED_ENTER_MS,
              easing: EASE_SMOOTH_OUT,
            }),
          ),
        ),
      );
      if (token === transitionToken) {
        cancelAnimations();
      }
      return;
    }

    // Optical Focus Dissolve: short blur-out, synchronous swap, crisp focus pull-in.
    await Promise.all(
      all.map((el) =>
        track(
          el.animate(
            [
              { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
              { opacity: 0, filter: "blur(3px)", transform: "translateY(-3px)" },
            ],
            { duration: EXIT_MS, easing: EASE_SMOOTH_OUT, fill: "forwards" },
          ),
        ),
      ),
    );
    if (token !== transitionToken || signal.aborted) {
      return;
    }

    applySnapshot(snapshot);

    await Promise.all(
      staggered.map(({ el, delay }) =>
        track(
          el.animate(
            [
              { opacity: 0, filter: "blur(3.5px)", transform: "translateY(5px)" },
              { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
            ],
            {
              duration: ENTER_MS,
              delay,
              easing: EASE_SMOOTH_OUT,
              fill: "both",
            },
          ),
        ),
      ),
    );
    if (token === transitionToken) {
      cancelAnimations();
    }
  };

  const switchTo = async (targetLang: Locale) => {
    if (targetLang === activeLang) {
      return;
    }
    const previousLang = activeLang;
    cancelAnimations();
    const token = ++transitionToken;

    let snapshot: PostContentSnapshot;
    if (targetLang === "en") {
      snapshot = englishSnapshot;
      activeLang = "en";
      syncControlState("en");
    } else {
      const hasCached = originalCache.has(originalHref);
      if (!hasCached) {
        syncControlState(previousLang, t.loadingOriginal);
      }
      try {
        snapshot = await fetchOriginalSnapshot(originalHref, uiLocale, fetcher);
      } catch {
        if (token === transitionToken && !signal.aborted) {
          syncControlState(previousLang, t.loadOriginalFailed);
        }
        return;
      }
      if (token !== transitionToken || signal.aborted) {
        return;
      }
      activeLang = "zh";
      syncControlState("zh");
    }

    await transitionToSnapshot(snapshot, token);
  };

  const prefetch = () => {
    void fetchOriginalSnapshot(originalHref, uiLocale, fetcher).catch(() => {});
  };

  for (const button of segButtons) {
    const target = button.dataset.contentLangTarget === "zh" ? "zh" : "en";
    button.addEventListener(
      "click",
      () => {
        void switchTo(target);
      },
      { signal },
    );
    if (target === "zh") {
      button.addEventListener("pointerenter", prefetch, { once: true, signal });
      button.addEventListener("focus", prefetch, { once: true, signal });
    }
  }

  if (metaLink) {
    metaLink.addEventListener("pointerenter", prefetch, { once: true, signal });
    metaLink.addEventListener("focus", prefetch, { once: true, signal });
    metaLink.addEventListener(
      "click",
      (event) => {
        if (!isUnmodifiedPrimaryClick(event)) {
          return;
        }
        event.preventDefault();
        void switchTo(activeLang === "en" ? "zh" : "en");
      },
      { signal },
    );
  }

  return () => {
    transitionToken += 1;
    cancelAnimations();
    controller.abort();
  };
}
