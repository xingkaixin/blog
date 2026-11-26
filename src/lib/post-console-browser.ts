import { localeFromLang } from "./i18n";
import { postsMessages } from "./messages/posts";
import {
  matchesPostConsoleFilter,
  postPreviewContent,
  type PostConsoleFilter,
} from "./post-console";
import { relatedPosts } from "./post-tags";
import { postHref } from "./published-post";

type PostConsoleRow = {
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  coverAlt: string;
  coverMobile: string;
  coverDesktop: string;
  coverMobileAvif: string;
  coverDesktopAvif: string;
  coverWidth: number;
  coverHeight: number;
  wordCount: number;
  readingMinutes: number;
};

type DetailsAnimationEntry = {
  anim: Animation;
  closing: boolean;
};

const initializedRoots = new WeakSet<HTMLElement>();

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getCssEasing(token: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function rowFlipDuration(): number {
  const isDesktop =
    typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1024px)").matches;
  return isDesktop ? 120 : 160;
}

function measureClosedDetailsHeight(details: HTMLDetailsElement): number | null {
  const summary = details.querySelector("summary");
  if (!(summary instanceof HTMLElement)) {
    return null;
  }
  const cs = getComputedStyle(details);
  const summaryRect = summary.getBoundingClientRect();
  return (
    summaryRect.height +
    parseFloat(cs.paddingTop) +
    parseFloat(cs.paddingBottom) +
    parseFloat(cs.borderTopWidth) +
    parseFloat(cs.borderBottomWidth)
  );
}

export function initializePostConsole(root: HTMLElement): void {
  if (initializedRoots.has(root)) {
    return;
  }
  initializedRoots.add(root);

  const locale = localeFromLang(document.documentElement.lang);
  const t = postsMessages[locale].console;
  const rows = [...root.querySelectorAll<HTMLElement>("[data-post-row]")];
  const compactData = readPostConsolePayload(root);
  const posts = rows.map((row) => readPostConsoleRow(row, compactData));
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  const months = [...root.querySelectorAll<HTMLDetailsElement>("[data-post-month]")];
  const monthsToggle = root.querySelector<HTMLButtonElement>("[data-post-months-toggle]");
  const initialYear = root.querySelector<HTMLElement>(
    '[data-filter-kind="year"][aria-pressed="true"]',
  )?.dataset.filterValue;
  const filter: PostConsoleFilter = { year: initialYear || null, tag: null };
  const initialActiveRow = rows.find((row) => row.hasAttribute("data-active")) ?? null;
  let previewSlug = initialActiveRow?.dataset.postRow ?? posts[0]?.slug ?? "";

  const monthAnimations = new WeakMap<HTMLDetailsElement, DetailsAnimationEntry>();
  const rowAnimations = new Map<HTMLElement, Animation>();

  const isMonthTargetOpen = (month: HTMLDetailsElement) => {
    const entry = monthAnimations.get(month);
    return entry ? !entry.closing : month.open;
  };

  const cancelMonthAnimation = (month: HTMLDetailsElement) => {
    const entry = monthAnimations.get(month);
    if (!entry) {
      return;
    }
    monthAnimations.delete(month);
    entry.anim.cancel();
    if (entry.closing) {
      month.open = false;
    }
    month.style.height = "";
    month.style.overflow = "";
  };

  const cancelRowAnimations = () => {
    for (const anim of rowAnimations.values()) {
      anim.cancel();
    }
    rowAnimations.clear();
  };

  const visibleMonths = () => months.filter((month) => !month.hidden);
  const syncMonthsToggle = () => {
    if (!monthsToggle) {
      return;
    }
    const shown = visibleMonths();
    const expanded = shown.length > 0 && shown.every((month) => isMonthTargetOpen(month));
    monthsToggle.textContent = expanded ? t.collapseAll : t.expandAll;
    monthsToggle.setAttribute("aria-expanded", String(expanded));
  };

  const setMonthOpen = (month: HTMLDetailsElement, targetOpen: boolean, animate: boolean) => {
    const entry = monthAnimations.get(month);
    if (entry) {
      if (entry.closing !== targetOpen) {
        return;
      }
    } else if (month.open === targetOpen) {
      return;
    }

    const startHeight = month.getBoundingClientRect().height || month.offsetHeight;
    if (entry) {
      monthAnimations.delete(month);
      entry.anim.cancel();
    }

    if (!animate || prefersReducedMotion() || typeof month.animate !== "function") {
      month.style.height = "";
      month.style.overflow = "";
      month.open = targetOpen;
      return;
    }

    const easing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");
    const duration = 160;

    if (targetOpen) {
      month.style.height = "";
      month.open = true;
      const endHeight = month.getBoundingClientRect().height || month.offsetHeight;
      if (Math.abs(endHeight - startHeight) < 1) {
        month.style.overflow = "";
        return;
      }
      month.style.overflow = "hidden";
      const anim = month.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
        duration,
        easing,
      });
      monthAnimations.set(month, { anim, closing: false });
      void anim.finished
        .catch(() => {})
        .finally(() => {
          if (monthAnimations.get(month)?.anim !== anim) {
            return;
          }
          monthAnimations.delete(month);
          month.style.height = "";
          month.style.overflow = "";
        });
      return;
    }

    const closedHeight = measureClosedDetailsHeight(month);
    if (closedHeight === null || startHeight <= closedHeight + 1) {
      month.style.height = "";
      month.style.overflow = "";
      month.open = false;
      return;
    }

    month.style.overflow = "hidden";
    month.style.height = `${closedHeight}px`;
    const anim = month.animate([{ height: `${startHeight}px` }, { height: `${closedHeight}px` }], {
      duration,
      easing,
    });
    monthAnimations.set(month, { anim, closing: true });
    void anim.finished
      .catch(() => {})
      .finally(() => {
        if (monthAnimations.get(month)?.anim !== anim) {
          return;
        }
        monthAnimations.delete(month);
        month.open = false;
        month.style.height = "";
        month.style.overflow = "";
        syncMonthsToggle();
      });
  };

  const renderPreview = (post: PostConsoleRow) => {
    const preview = root.querySelector<HTMLElement>("[data-post-preview]");
    if (!preview) {
      return;
    }
    preview.hidden = false;
    const content = postPreviewContent(
      post,
      {
        mobile: post.coverMobile,
        desktop: post.coverDesktop,
        mobileAvif: post.coverMobileAvif,
        desktopAvif: post.coverDesktopAvif,
      },
      locale,
    );
    for (const link of preview.querySelectorAll<HTMLAnchorElement>("[data-preview-link]")) {
      link.href = postHref(post.slug, locale);
    }
    const image = preview.querySelector<HTMLImageElement>("[data-preview-image]");
    if (image) {
      image.src = post.coverDesktop;
      image.alt = post.coverAlt;
      image.width = post.coverWidth;
      image.height = post.coverHeight;
    }
    const avifSource = preview.querySelector<HTMLSourceElement>("[data-preview-source-avif]");
    if (avifSource) {
      if (content.coverAvifSrcSet) {
        avifSource.srcset = content.coverAvifSrcSet;
      } else {
        avifSource.removeAttribute("srcset");
      }
    }
    const source = preview.querySelector<HTMLSourceElement>("[data-preview-source]");
    if (source) {
      source.srcset = content.coverSrcSet;
    }
    setText(preview, "[data-preview-title]", post.title);
    setText(preview, "[data-preview-summary]", post.summary);
    setText(preview, "[data-preview-word-count]", content.wordCount);
    setText(preview, "[data-preview-reading-minutes]", content.readingMinutes);
    setText(preview, "[data-preview-tags]", content.tags);

    const recommendations = relatedPosts(posts, post);
    const related = preview.querySelector<HTMLElement>("[data-preview-related]");
    const linkTemplate = preview.querySelector<HTMLTemplateElement>(
      "[data-preview-related-template]",
    )?.content.firstElementChild;
    if (related && linkTemplate) {
      related.replaceChildren(
        ...recommendations.map((item) => {
          const link = linkTemplate.cloneNode(true) as HTMLAnchorElement;
          link.href = postHref(item.slug, locale);
          link.textContent = item.title;
          return link;
        }),
      );
    }
    const relatedSection = preview.querySelector<HTMLElement>("[data-preview-related-section]");
    if (relatedSection) {
      relatedSection.hidden = recommendations.length === 0;
    }
  };

  const selectPreview = (slug: string) => {
    const changed = previewSlug !== slug;
    previewSlug = slug;
    for (const row of rows) {
      row.toggleAttribute("data-active", row.dataset.postRow === slug);
    }
    const post = postsBySlug.get(slug);
    const preview = root.querySelector<HTMLElement>("[data-post-preview]");
    if (preview) {
      preview.hidden = !post;
    }
    if (post && changed) {
      renderPreview(post);
    }
  };

  const applyFilter = (animate: boolean) => {
    const canFlip = animate && !prefersReducedMotion() && typeof root.animate === "function";

    const beforeTopByRow = new Map<HTMLElement, number>();
    const wasHidden = new Set<HTMLElement>();
    if (canFlip) {
      for (const row of rows) {
        if (row.hidden) {
          wasHidden.add(row);
          continue;
        }
        const rect = row.getBoundingClientRect();
        if (rect.height > 0) {
          beforeTopByRow.set(row, rect.top);
        }
      }
    }

    cancelRowAnimations();
    for (const month of months) {
      cancelMonthAnimation(month);
    }

    const visibleRows = rows.filter((row) => {
      const post = postsBySlug.get(row.dataset.postRow ?? "");
      const visible = Boolean(post && matchesPostConsoleFilter(post, filter));
      row.hidden = !visible;
      return visible;
    });

    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-post-filter]")) {
      const kind = button.dataset.filterKind as keyof PostConsoleFilter;
      const value = button.dataset.filterValue || null;
      button.setAttribute("aria-pressed", String(filter[kind] === value));
    }
    const initialActiveMonth = !animate ? initialActiveRow?.closest("[data-post-month]") : null;
    // 只展开最近的月份；按标签筛选时结果不多，全部展开。
    let opened = false;
    for (const month of months) {
      const count = month.querySelectorAll("[data-post-row]:not([hidden])").length;
      month.hidden = count === 0;
      month.open = count > 0 && (filter.tag !== null || !opened || month === initialActiveMonth);
      opened ||= count > 0;
      setText(month, "[data-post-month-count]", t.monthCount(count));
    }
    syncMonthsToggle();

    setText(root, "[data-post-console-heading]", filter.tag ?? t.headingAll);
    const empty = root.querySelector<HTMLElement>("[data-post-console-empty]");
    if (empty) {
      empty.hidden = visibleRows.length > 0;
    }
    const list = root.querySelector<HTMLElement>("[data-post-console-list]");
    if (list) {
      list.hidden = visibleRows.length === 0;
    }

    const previewVisible = visibleRows.some((row) => row.dataset.postRow === previewSlug);
    selectPreview(previewVisible ? previewSlug : (visibleRows[0]?.dataset.postRow ?? ""));

    if (!canFlip) {
      return;
    }

    const duration = rowFlipDuration();
    const easing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");
    for (const row of visibleRows) {
      const rect = row.getBoundingClientRect();
      if (rect.height === 0) {
        continue;
      }
      const beforeTop = beforeTopByRow.get(row);
      let anim: Animation | null = null;
      if (beforeTop !== undefined) {
        const dy = beforeTop - rect.top;
        if (Math.abs(dy) >= 0.5) {
          anim = row.animate(
            [{ transform: `translate3d(0, ${dy}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
            { duration, easing },
          );
        }
      } else if (wasHidden.has(row)) {
        anim = row.animate(
          [
            { opacity: 0, transform: "translate3d(0, 8px, 0)" },
            { opacity: 1, transform: "translate3d(0, 0, 0)" },
          ],
          { duration, easing },
        );
      }

      if (anim) {
        rowAnimations.set(row, anim);
        const currentAnim = anim;
        void currentAnim.finished
          .catch(() => {})
          .finally(() => {
            if (rowAnimations.get(row) === currentAnim) {
              rowAnimations.delete(row);
            }
          });
      }
    }
  };

  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-post-filter]")) {
    button.addEventListener("click", () => {
      const kind = button.dataset.filterKind as keyof PostConsoleFilter;
      const value = button.dataset.filterValue || null;
      filter[kind] = kind === "tag" && filter.tag === value ? null : value;
      applyFilter(true);
    });
  }

  monthsToggle?.addEventListener("click", () => {
    const shown = visibleMonths();
    const expand = !shown.every((month) => isMonthTargetOpen(month));
    for (const month of shown) {
      setMonthOpen(month, expand, true);
    }
    syncMonthsToggle();
  });
  for (const month of months) {
    month.addEventListener("toggle", syncMonthsToggle);
    const summary = month.querySelector("summary");
    summary?.addEventListener("click", (event) => {
      event.preventDefault();
      setMonthOpen(month, !isMonthTargetOpen(month), true);
      syncMonthsToggle();
    });
  }

  root.querySelector<HTMLButtonElement>("[data-clear-tag]")?.addEventListener("click", () => {
    filter.tag = null;
    applyFilter(true);
  });

  for (const row of rows) {
    const selectRow = () => selectPreview(row.dataset.postRow ?? "");
    row.addEventListener("mouseenter", selectRow);
    row.addEventListener("focus", selectRow);
  }

  applyFilter(false);
}

function setText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = value;
  }
}

type PostConsoleTuple = readonly [
  slug: string,
  date: string,
  tags: string[],
  summary: string,
  coverAlt: string,
  coverMobile: string,
  coverDesktop: string,
  coverWidth: number,
  coverHeight: number,
  wordCount: number,
  readingMinutes: number,
  coverDesktopAvif?: string,
  coverMobileAvif?: string,
];

function readAgentSummaries(): Map<string, string> {
  const summaries = new Map<string, string>();
  const template = document.querySelector<HTMLTemplateElement>("template[data-agent-content]");
  if (!template) {
    return summaries;
  }
  for (const item of template.content.querySelectorAll("li")) {
    const href = item.querySelector("a")?.getAttribute("href") ?? "";
    const match = href.match(/^\/(?:en\/)?posts\/([^/]+)\/?$/);
    const summary = item.querySelector("p")?.textContent?.trim();
    if (match && summary) {
      summaries.set(match[1], summary);
    }
  }
  return summaries;
}

function readPostConsolePayload(root: HTMLElement): Map<string, PostConsoleTuple> | null {
  const script = root.querySelector<HTMLScriptElement>("script[data-post-console-data]");
  if (!script?.textContent) {
    return null;
  }
  const tuples = JSON.parse(script.textContent) as PostConsoleTuple[];
  const agentSummaries = readAgentSummaries();
  return new Map(
    tuples.map((tuple) => [
      tuple[0],
      tuple[3]
        ? tuple
        : ([
            tuple[0],
            tuple[1],
            tuple[2],
            agentSummaries.get(tuple[0]) ?? "",
            tuple[4],
            tuple[5],
            tuple[6],
            tuple[7],
            tuple[8],
            tuple[9],
            tuple[10],
            tuple[11],
            tuple[12],
          ] as const),
    ]),
  );
}

function readPostConsoleRow(
  row: HTMLElement,
  compactData: Map<string, PostConsoleTuple> | null,
): PostConsoleRow {
  const slug = row.dataset.postRow ?? "";
  const title = row.querySelector("[data-post-title]")?.textContent?.trim() ?? "";
  const tuple = compactData?.get(slug);
  if (tuple) {
    const coverDesktop = tuple[6];
    const coverDesktopAvif = tuple[11] ?? "";
    return {
      slug,
      title,
      date: tuple[1],
      tags: tuple[2],
      summary: tuple[3],
      coverAlt: tuple[4] || title,
      coverMobile: tuple[5] || coverDesktop.replace("-800.", "-400."),
      coverDesktop,
      coverMobileAvif: tuple[12] || coverDesktopAvif.replace("-800.", "-400."),
      coverDesktopAvif,
      coverWidth: tuple[7],
      coverHeight: tuple[8],
      wordCount: tuple[9],
      readingMinutes: tuple[10],
    };
  }
  return {
    slug,
    title,
    summary: row.dataset.postSummary ?? "",
    date: row.dataset.postDate ?? "",
    tags: JSON.parse(row.dataset.postTags ?? "[]") as string[],
    coverAlt: row.dataset.postCoverAlt ?? "",
    coverMobile: row.dataset.postCoverMobile ?? "",
    coverDesktop: row.dataset.postCoverDesktop ?? "",
    coverMobileAvif: row.dataset.postCoverMobileAvif ?? "",
    coverDesktopAvif: row.dataset.postCoverDesktopAvif ?? "",
    coverWidth: Number(row.dataset.postCoverWidth),
    coverHeight: Number(row.dataset.postCoverHeight),
    wordCount: Number(row.dataset.postWordCount),
    readingMinutes: Number(row.dataset.postReadingMinutes),
  };
}
