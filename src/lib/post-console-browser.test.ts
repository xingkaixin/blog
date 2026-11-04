// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import type { PostConsoleItem } from "./post-console";
import { initializePostConsole } from "./post-console-browser";

type PostMetadata = Pick<PostConsoleItem, "slug" | "title" | "date" | "summary" | "tags">;

const posts: PostMetadata[] = [
  post("first", "2026-02-02", ["AI"]),
  post("second", "2026-01-01", ["生活"]),
  post("third", "2025-12-31", ["AI"]),
];

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `
    <section data-post-console>
      <div aria-label="按年份筛选文章">
        <button data-post-filter data-filter-kind="year" data-filter-value="" aria-pressed="true">全部年份</button>
        <button data-post-filter data-filter-kind="year" data-filter-value="2026" aria-pressed="false">2026</button>
        <button data-post-filter data-filter-kind="year" data-filter-value="2025" aria-pressed="false">2025</button>
      </div>
      <div aria-label="按年份筛选文章">
        <button data-post-filter data-filter-kind="year" data-filter-value="" aria-pressed="true">全部</button>
        <button data-post-filter data-filter-kind="year" data-filter-value="2026" aria-pressed="false">2026</button>
        <button data-post-filter data-filter-kind="year" data-filter-value="2025" aria-pressed="false">2025</button>
      </div>
      <div aria-label="按标签筛选文章">
        <button data-post-filter data-filter-kind="tag" data-filter-value="" aria-pressed="true">全部</button>
        <button data-post-filter data-filter-kind="tag" data-filter-value="AI" aria-pressed="false">AI</button>
      </div>
      <span data-post-console-heading></span>
      <div data-post-console-list>${posts.map(monthGroup).join("")}</div>
      <div data-post-console-empty hidden><button data-clear-tag></button></div>
      <aside data-post-preview>
        <a data-preview-link><span data-preview-title>first</span></a>
        <picture><source data-preview-source><img data-preview-image></picture>
        <span data-preview-summary></span>
        <span data-preview-word-count></span>
        <span data-preview-reading-minutes></span>
        <span data-preview-tags></span>
        <div data-preview-related-section>
          <template data-preview-related-template><a class="preview-related-link" aria-label="相关文章"></a></template>
          <div data-preview-related></div>
        </div>
      </aside>
    </section>`;
  root = document.querySelector("[data-post-console]")!;
  initializePostConsole(root);
});

describe("initializePostConsole", () => {
  it("shows only posts matching the selected year and tag", () => {
    button("按年份筛选文章", "2025").click();
    expect(visiblePostSlugs()).toEqual(["third"]);

    button("按年份筛选文章", "全部年份").click();
    button("按标签筛选文章", "AI").click();
    expect(visiblePostSlugs()).toEqual(["first", "third"]);
  });
});

function button(groupLabel: string, label: string): HTMLButtonElement {
  const groups = [...root.querySelectorAll<HTMLElement>(`[aria-label="${groupLabel}"]`)];
  const match = groups
    .flatMap((group) => [...group.querySelectorAll("button")])
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`找不到筛选按钮 ${label}`);
  }
  return match;
}

function visiblePostSlugs(): string[] {
  return [...root.querySelectorAll<HTMLElement>("[data-post-row]")]
    .filter((element) => !element.hidden)
    .map((element) => element.dataset.postRow ?? "");
}

function monthGroup(item: PostMetadata): string {
  return `<details data-post-month="${item.date.slice(0, 7)}">${postRow(item)}</details>`;
}

function post(slug: string, date: string, tags: string[]): PostMetadata {
  return {
    slug,
    title: slug,
    date,
    summary: `${slug} summary`,
    tags,
  };
}

function postRow(item: PostMetadata): string {
  return `<a
    data-post-row="${item.slug}"
    data-post-date="${item.date}"
    data-post-summary="${item.summary}"
    data-post-tags='${JSON.stringify(item.tags)}'
    data-post-cover-alt="${item.slug} cover"
    data-post-cover-mobile="/${item.slug}-400.webp"
    data-post-cover-desktop="/${item.slug}-800.webp"
    data-post-cover-width="${item.slug === "third" ? 900 : 1200}"
    data-post-cover-height="${item.slug === "third" ? 1200 : 800}"
    data-post-word-count="100"
    data-post-reading-minutes="1"
    href="/posts/${item.slug}/"
  ><span data-post-title>${item.title}</span></a>`;
}
