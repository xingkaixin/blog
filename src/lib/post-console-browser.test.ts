// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { initializePostConsole } from "./post-console-browser";
import type { SearchIndexItem } from "./search-index";

const posts: SearchIndexItem[] = [
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
      <div data-post-console-list>${posts.map(postRow).join("")}</div>
      <div data-post-console-empty hidden><button data-clear-tag></button></div>
      <aside data-post-preview>
        <a data-preview-link><span data-preview-title>first</span></a>
        <picture><source data-preview-source><img data-preview-image></picture>
        <span data-preview-summary></span>
        <span data-preview-word-count></span>
        <span data-preview-reading-minutes></span>
        <span data-preview-tags></span>
        <div data-preview-related-section><div data-preview-related></div></div>
      </aside>
    </section>`;
  root = document.querySelector("[data-post-console]")!;
  initializePostConsole(root, async () => posts);
});

describe("initializePostConsole", () => {
  it("keeps duplicate filter controls on the same state", () => {
    button("按年份筛选文章", "2025").click();
    expect(visiblePostSlugs()).toEqual(["third"]);
    expect(
      [...root.querySelectorAll('[aria-label="按年份筛选文章"]')].every((group) =>
        group.querySelector('[aria-pressed="true"]')?.textContent?.includes("2025"),
      ),
    ).toBe(true);

    button("按年份筛选文章", "全部年份").click();
    button("按标签筛选文章", "AI").click();
    expect(visiblePostSlugs()).toEqual(["first", "third"]);
  });

  it("loads preview details only when the active article changes", async () => {
    root
      .querySelector<HTMLElement>('[data-post-row="third"]')
      ?.dispatchEvent(new Event("mouseenter"));
    await Promise.resolve();

    expect(root.querySelector("[data-preview-title]")?.textContent).toBe("third");
    expect(root.querySelector<HTMLImageElement>("[data-preview-image]")?.src).toContain(
      "/third-800.webp",
    );
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

function post(slug: string, date: string, tags: string[]): SearchIndexItem {
  return {
    slug,
    title: slug,
    date,
    summary: `${slug} summary`,
    tags,
  };
}

function postRow(item: SearchIndexItem): string {
  return `<a
    data-post-row="${item.slug}"
    data-post-date="${item.date}"
    data-post-tags='${JSON.stringify(item.tags)}'
    data-post-cover-alt="${item.slug} cover"
    data-post-cover-mobile="/${item.slug}-400.webp"
    data-post-cover-desktop="/${item.slug}-800.webp"
    data-post-word-count="100"
    data-post-reading-minutes="1"
    href="/posts/${item.slug}/"
  ></a>`;
}
