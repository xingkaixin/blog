import {
  matchesPostConsoleFilter,
  relatedPostConsoleItems,
  type PostConsoleFilter,
} from "./post-console";
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
  coverWidth: number;
  coverHeight: number;
  wordCount: number;
  readingMinutes: number;
};

const initializedRoots = new WeakSet<HTMLElement>();

export function initializePostConsole(root: HTMLElement): void {
  if (initializedRoots.has(root)) {
    return;
  }
  initializedRoots.add(root);

  const rows = [...root.querySelectorAll<HTMLElement>("[data-post-row]")];
  const posts = rows.map(readPostConsoleRow);
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  const filter: PostConsoleFilter = { year: null, tag: null };
  let previewSlug = posts[0]?.slug ?? "";

  const renderPreview = (post: PostConsoleRow) => {
    const preview = root.querySelector<HTMLElement>("[data-post-preview]");
    if (!preview) {
      return;
    }
    preview.hidden = false;
    for (const link of preview.querySelectorAll<HTMLAnchorElement>("[data-preview-link]")) {
      link.href = postHref(post.slug);
    }
    const image = preview.querySelector<HTMLImageElement>("[data-preview-image]");
    if (image) {
      image.src = post.coverDesktop;
      image.alt = post.coverAlt;
      image.width = post.coverWidth;
      image.height = post.coverHeight;
    }
    const source = preview.querySelector<HTMLSourceElement>("[data-preview-source]");
    if (source) {
      source.srcset = `${post.coverMobile} 1x, ${post.coverDesktop} 2x`;
    }
    setText(preview, "[data-preview-title]", post.title);
    setText(preview, "[data-preview-summary]", post.summary);
    setText(preview, "[data-preview-word-count]", post.wordCount.toLocaleString("zh-CN"));
    setText(preview, "[data-preview-reading-minutes]", `${post.readingMinutes} min`);
    setText(preview, "[data-preview-tags]", post.tags.join(" · "));

    const relatedPosts = relatedPostConsoleItems(posts, post);
    const related = preview.querySelector<HTMLElement>("[data-preview-related]");
    if (related) {
      related.replaceChildren(
        ...relatedPosts.map((item) => {
          const link = document.createElement("a");
          link.href = postHref(item.slug);
          link.className =
            "line-clamp-2 text-[13px] leading-6 text-ink-600 transition-colors hover:text-accent";
          link.textContent = item.title;
          return link;
        }),
      );
    }
    const relatedSection = preview.querySelector<HTMLElement>("[data-preview-related-section]");
    if (relatedSection) {
      relatedSection.hidden = relatedPosts.length === 0;
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

  const applyFilter = () => {
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
    setText(root, "[data-post-console-heading]", filter.tag ?? "全部文章");
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
  };

  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-post-filter]")) {
    button.addEventListener("click", () => {
      const kind = button.dataset.filterKind as keyof PostConsoleFilter;
      const value = button.dataset.filterValue || null;
      filter[kind] = kind === "tag" && filter.tag === value ? null : value;
      applyFilter();
    });
  }

  root.querySelector<HTMLButtonElement>("[data-clear-tag]")?.addEventListener("click", () => {
    filter.tag = null;
    applyFilter();
  });

  for (const row of rows) {
    const selectRow = () => selectPreview(row.dataset.postRow ?? "");
    row.addEventListener("mouseenter", selectRow);
    row.addEventListener("focus", selectRow);
  }

  root
    .querySelector<HTMLElement>("[data-post-console-list]")
    ?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }
      const visibleRows = rows.filter((row) => !row.hidden);
      if (visibleRows.length === 0) {
        return;
      }
      event.preventDefault();
      const currentIndex = Math.max(
        0,
        visibleRows.findIndex((row) => row === root.ownerDocument.activeElement),
      );
      const direction = event.key === "ArrowDown" ? 1 : -1;
      visibleRows[(currentIndex + direction + visibleRows.length) % visibleRows.length].focus();
    });

  applyFilter();
}

function setText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = value;
  }
}

function readPostConsoleRow(row: HTMLElement): PostConsoleRow {
  return {
    slug: row.dataset.postRow ?? "",
    title: row.querySelector("[data-post-title]")?.textContent?.trim() ?? "",
    summary: row.dataset.postSummary ?? "",
    date: row.dataset.postDate ?? "",
    tags: JSON.parse(row.dataset.postTags ?? "[]") as string[],
    coverAlt: row.dataset.postCoverAlt ?? "",
    coverMobile: row.dataset.postCoverMobile ?? "",
    coverDesktop: row.dataset.postCoverDesktop ?? "",
    coverWidth: Number(row.dataset.postCoverWidth),
    coverHeight: Number(row.dataset.postCoverHeight),
    wordCount: Number(row.dataset.postWordCount),
    readingMinutes: Number(row.dataset.postReadingMinutes),
  };
}
