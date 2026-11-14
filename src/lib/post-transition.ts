import { postPreviewContent } from "./post-console";
import { postHref } from "./published-post";
import {
  isDarkroomTransition,
  isSiblingNavigation,
  isTagArchivePath,
  normalizeSitePath,
  parsePostDetailSlug,
} from "./site-navigation";

type TransitionPlan = {
  runId: number;
  kind: "sibling" | "post-shared" | null;
  darkroom: boolean;
  direction: "forward" | "back" | null;
  slug: string | null;
  toPath: string;
  hasSourceTitle: boolean;
  hasSourceCover: boolean;
};

let installed = false;
let runCounter = 0;
let activePlan: TransitionPlan | null = null;
let inFlightViewTransition: ViewTransition | null = null;

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replaceAll('"', '\\"');
}

function isRenderVisible(element: Element | null, minOpacity = 0): element is HTMLElement {
  if (!(element instanceof HTMLElement) || element.getClientRects().length === 0) {
    return false;
  }
  const style = getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    parseFloat(style.opacity) > minOpacity
  );
}

function isNearViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight * 1.1;
}

function clearTransitionNames(root: ParentNode) {
  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-post-title], [data-post-cover], [style*='view-transition-name']",
  )) {
    if (element.hasAttribute("data-nav-active-pill")) {
      continue;
    }
    if (
      element.style.viewTransitionName === "post-title" ||
      element.style.viewTransitionName === "post-cover"
    ) {
      element.style.viewTransitionName = "";
    }
  }
  for (const element of root.querySelectorAll<HTMLElement>("[data-post-cover-reveal]")) {
    element.removeAttribute("data-post-cover-reveal");
  }
}

export function cleanupPostTransition(doc: Document = document): void {
  delete doc.documentElement.dataset.navKind;
  delete doc.documentElement.dataset.darkroomTransition;
  clearTransitionNames(doc);
}

function applyRootAttributes(doc: Document, kind: TransitionPlan["kind"], darkroom: boolean): void {
  if (kind) {
    doc.documentElement.dataset.navKind = kind;
  } else {
    delete doc.documentElement.dataset.navKind;
  }
  if (darkroom) {
    doc.documentElement.dataset.darkroomTransition = "";
  } else {
    delete doc.documentElement.dataset.darkroomTransition;
  }
}

function isPostEntryTrigger(sourceElement: Element | undefined): boolean {
  return Boolean(
    sourceElement?.closest("[data-post-row], [data-preview-link], [data-tag-post-row]"),
  );
}

function isPostReturnTrigger(sourceElement: Element | undefined, navigationType: string): boolean {
  if (navigationType === "traverse") {
    return true;
  }
  return Boolean(sourceElement?.closest("[data-breadcrumb] a, [data-compact-back]"));
}

function isReturnTarget(pathname: string): boolean {
  const path = normalizeSitePath(pathname);
  return path === "/posts" || path === "/" || isTagArchivePath(path);
}

function pickVisiblePostTitle(container: ParentNode | null): HTMLElement | null {
  if (!container) {
    return null;
  }
  for (const candidate of container.querySelectorAll<HTMLElement>("[data-post-title]")) {
    if (isRenderVisible(candidate)) {
      return candidate;
    }
  }
  return null;
}

function matchesDestinationPath(link: Element | null, toPath: string): boolean {
  const href = link?.getAttribute("href");
  if (!href) {
    return false;
  }
  try {
    return normalizeSitePath(new URL(href, window.location.origin).pathname) === toPath;
  } catch {
    return false;
  }
}

function findForwardSourceElements(
  sourceElement: Element | undefined,
  fromPath: string,
  toPath: string,
  slug: string,
): { title: HTMLElement | null; cover: HTMLElement | null } {
  if (fromPath === "/posts") {
    const preview = document.querySelector<HTMLElement>("[data-post-preview]");
    const clickedPreview = sourceElement?.closest("[data-post-preview]");
    const previewCover = preview?.querySelector<HTMLElement>("[data-post-cover]") ?? null;
    const previewTitle = preview?.querySelector<HTMLElement>("[data-post-title]") ?? null;
    const previewMatches =
      isRenderVisible(previewCover) && matchesDestinationPath(previewCover, toPath);

    if (clickedPreview && matchesDestinationPath(clickedPreview.closest("a"), toPath)) {
      return {
        title: isRenderVisible(previewTitle) ? previewTitle : null,
        cover: previewMatches ? previewCover : null,
      };
    }

    const row =
      sourceElement?.closest<HTMLElement>("[data-post-row]") ??
      document.querySelector<HTMLElement>(`[data-post-row="${cssEscape(slug)}"]`);
    return {
      title: pickVisiblePostTitle(row),
      cover: previewMatches ? previewCover : null,
    };
  }

  if (isTagArchivePath(fromPath)) {
    const row =
      sourceElement?.closest<HTMLElement>("[data-tag-post-row]") ??
      document.querySelector<HTMLElement>(`[data-tag-post-row="${cssEscape(slug)}"]`);
    const cover = row?.querySelector<HTMLElement>("[data-post-cover]") ?? null;
    return {
      title: pickVisiblePostTitle(row),
      cover: isRenderVisible(cover, 0.05) ? cover : null,
    };
  }

  return { title: null, cover: null };
}

function syncReturningPostConsole(newDoc: Document, slug: string): void {
  const row = newDoc.querySelector<HTMLElement>(`[data-post-row="${cssEscape(slug)}"]`);
  if (!row) {
    return;
  }

  const postYear = row.dataset.postDate?.slice(0, 4) ?? "";
  const activeYearBtn = newDoc.querySelector<HTMLElement>(
    '[data-filter-kind="year"][aria-pressed="true"]',
  );
  const activeYear = activeYearBtn?.dataset.filterValue ?? "";
  if (activeYear && postYear && activeYear !== postYear) {
    const hasYearOption = Boolean(
      newDoc.querySelector(`[data-filter-kind="year"][data-filter-value="${cssEscape(postYear)}"]`),
    );
    const targetYear = hasYearOption ? postYear : "";
    for (const button of newDoc.querySelectorAll<HTMLElement>('[data-filter-kind="year"]')) {
      button.setAttribute(
        "aria-pressed",
        String((button.dataset.filterValue ?? "") === targetYear),
      );
    }
  }

  for (const active of newDoc.querySelectorAll<HTMLElement>("[data-post-row][data-active]")) {
    active.removeAttribute("data-active");
  }
  row.setAttribute("data-active", "");
  row.closest("details")?.setAttribute("open", "");

  const preview = newDoc.querySelector<HTMLElement>("[data-post-preview]");
  if (!preview) {
    return;
  }

  const tags = JSON.parse(row.dataset.postTags ?? "[]") as string[];
  const content = postPreviewContent(
    {
      wordCount: Number(row.dataset.postWordCount),
      readingMinutes: Number(row.dataset.postReadingMinutes),
      tags,
    },
    {
      mobile: row.dataset.postCoverMobile ?? "",
      desktop: row.dataset.postCoverDesktop ?? "",
    },
  );
  const href = postHref(slug);
  for (const link of preview.querySelectorAll<HTMLAnchorElement>("[data-preview-link]")) {
    link.href = href;
  }
  const image = preview.querySelector<HTMLImageElement>("[data-preview-image]");
  if (image) {
    image.src = row.dataset.postCoverDesktop ?? "";
    image.alt = row.dataset.postCoverAlt ?? "";
    image.width = Number(row.dataset.postCoverWidth);
    image.height = Number(row.dataset.postCoverHeight);
  }
  const source = preview.querySelector<HTMLSourceElement>("[data-preview-source]");
  if (source) {
    source.srcset = content.coverSrcSet;
  }
  const titleText = row.querySelector("[data-post-title]")?.textContent?.trim() ?? "";
  const setText = (selector: string, value: string) => {
    const element = preview.querySelector<HTMLElement>(selector);
    if (element) {
      element.textContent = value;
    }
  };
  setText("[data-preview-title]", titleText);
  setText("[data-preview-summary]", row.dataset.postSummary ?? "");
  setText("[data-preview-word-count]", content.wordCount);
  setText("[data-preview-reading-minutes]", content.readingMinutes);
  setText("[data-preview-tags]", content.tags);
}

function canExpectReturnCover(newDoc: Document, toPath: string, slug: string): boolean {
  if (toPath !== "/posts") {
    return false;
  }
  const isXl =
    typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1280px)").matches;
  if (!isXl) {
    return false;
  }
  return Boolean(
    newDoc.querySelector(`[data-post-row="${cssEscape(slug)}"]`) &&
    newDoc.querySelector("[data-post-preview] [data-post-cover]"),
  );
}

export function installPostTransitions(): void {
  if (installed) {
    return;
  }
  installed = true;

  document.addEventListener("astro:before-preparation", (event) => {
    const fromPath = normalizeSitePath(event.from.pathname);
    const toPath = normalizeSitePath(event.to.pathname);
    const fromSlug = parsePostDetailSlug(fromPath);
    const toSlug = parsePostDetailSlug(toPath);

    if (fromSlug && isReturnTarget(toPath)) {
      event.direction = "back";
    } else if (isTagArchivePath(fromPath) && fromPath !== "/tags" && toPath === "/tags") {
      event.direction = "back";
    }

    const darkroom = isDarkroomTransition(fromPath, toPath);
    const sibling = isSiblingNavigation(fromPath, toPath);

    let direction: TransitionPlan["direction"] = null;
    let slug: string | null = null;
    if (
      toSlug &&
      (fromPath === "/posts" || (isTagArchivePath(fromPath) && fromPath !== "/tags")) &&
      (isPostEntryTrigger(event.sourceElement) || event.navigationType === "traverse")
    ) {
      direction = "forward";
      slug = toSlug;
    } else if (
      fromSlug &&
      isReturnTarget(toPath) &&
      isPostReturnTrigger(event.sourceElement, event.navigationType)
    ) {
      direction = "back";
      slug = fromSlug;
    }

    const kind: TransitionPlan["kind"] = direction ? "post-shared" : sibling ? "sibling" : null;
    const originalLoader = event.loader;

    event.loader = async () => {
      await originalLoader();
      if (event.signal.aborted || event.defaultPrevented || !event.newDocument) {
        return;
      }

      cleanupPostTransition();
      runCounter += 1;
      const runId = runCounter;

      const plan: TransitionPlan = {
        runId,
        kind,
        darkroom,
        direction,
        slug,
        toPath,
        hasSourceTitle: false,
        hasSourceCover: false,
      };
      activePlan = plan;

      applyRootAttributes(document, kind, darkroom);
      applyRootAttributes(event.newDocument, kind, darkroom);

      if (kind === "post-shared" && slug) {
        if (direction === "forward") {
          const source = findForwardSourceElements(event.sourceElement, fromPath, toPath, slug);
          if (source.title) {
            source.title.style.viewTransitionName = "post-title";
            plan.hasSourceTitle = true;
          }
          if (source.cover) {
            source.cover.style.viewTransitionName = "post-cover";
            plan.hasSourceCover = true;
          }
        } else if (direction === "back") {
          const sourceTitle = document.querySelector<HTMLElement>("[data-post-title]");
          if (isRenderVisible(sourceTitle)) {
            sourceTitle.style.viewTransitionName = "post-title";
            plan.hasSourceTitle = true;
          }
          const sourceCover = document.querySelector<HTMLElement>("[data-post-cover]");
          if (
            isRenderVisible(sourceCover) &&
            canExpectReturnCover(event.newDocument, toPath, slug)
          ) {
            sourceCover.style.viewTransitionName = "post-cover";
            plan.hasSourceCover = true;
          }
        }
      }

      event.signal.addEventListener(
        "abort",
        () => {
          if (runCounter === runId) {
            activePlan = null;
            cleanupPostTransition();
          }
        },
        { once: true },
      );
    };
  });

  document.addEventListener("astro:before-swap", (event) => {
    const plan = activePlan;
    if (!plan) {
      return;
    }

    if (plan.direction === "back" && plan.toPath === "/posts" && plan.slug) {
      syncReturningPostConsole(event.newDocument, plan.slug);
    }

    applyRootAttributes(event.newDocument, plan.kind, plan.darkroom);

    const viewTransition = event.viewTransition;
    inFlightViewTransition = viewTransition;
    const { runId } = plan;
    void viewTransition.finished
      .catch(() => {})
      .finally(() => {
        if (inFlightViewTransition === viewTransition) {
          inFlightViewTransition = null;
        }
        if (runCounter === runId) {
          activePlan = null;
          cleanupPostTransition();
        }
      });
  });

  document.addEventListener("astro:after-swap", () => {
    const plan = activePlan;
    if (!plan || plan.kind !== "post-shared" || !plan.slug) {
      return;
    }

    if (plan.direction === "forward") {
      const targetTitle = document.querySelector<HTMLElement>("[data-post-title]");
      if (plan.hasSourceTitle && isRenderVisible(targetTitle)) {
        targetTitle.style.viewTransitionName = "post-title";
      }
      const targetCover = document.querySelector<HTMLElement>("[data-post-cover]");
      if (targetCover && isRenderVisible(targetCover)) {
        if (plan.hasSourceCover) {
          targetCover.style.viewTransitionName = "post-cover";
        } else {
          targetCover.setAttribute("data-post-cover-reveal", "");
        }
      }
      return;
    }

    if (plan.direction === "back") {
      if (plan.toPath === "/posts") {
        const row = document.querySelector<HTMLElement>(
          `[data-post-row="${cssEscape(plan.slug)}"]`,
        );
        const targetTitle = pickVisiblePostTitle(row);
        if (plan.hasSourceTitle && targetTitle && isNearViewport(targetTitle)) {
          targetTitle.style.viewTransitionName = "post-title";
        }
        const previewCover = document.querySelector<HTMLElement>(
          "[data-post-preview] [data-post-cover]",
        );
        if (
          plan.hasSourceCover &&
          isRenderVisible(previewCover) &&
          matchesDestinationPath(previewCover, `/posts/${encodeURIComponent(plan.slug)}`)
        ) {
          previewCover.style.viewTransitionName = "post-cover";
        }
      } else if (isTagArchivePath(plan.toPath)) {
        const row = document.querySelector<HTMLElement>(
          `[data-tag-post-row="${cssEscape(plan.slug)}"]`,
        );
        const targetTitle = pickVisiblePostTitle(row);
        if (plan.hasSourceTitle && targetTitle && isNearViewport(targetTitle)) {
          targetTitle.style.viewTransitionName = "post-title";
        }
      }
    }
  });

  document.addEventListener("astro:page-load", () => {
    if (!inFlightViewTransition) {
      cleanupPostTransition();
    }
  });
}
