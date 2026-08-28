// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("搜索索引不可用")));
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
  initializePostConsole(root);
});

afterEach(() => vi.unstubAllGlobals());

describe("initializePostConsole", () => {
  it.each([
    ["ArrowDown", "first"],
    ["ArrowUp", "third"],
  ])("enters the list at %s when no row has focus", (key, slug) => {
    const list = root.querySelector<HTMLElement>("[data-post-console-list]")!;
    list.tabIndex = -1;
    list.focus();
    list.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    expect(document.activeElement).toBe(root.querySelector(`[data-post-row="${slug}"]`));
  });
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

  it("updates preview details from the page without fetching an index", () => {
    root
      .querySelector<HTMLElement>('[data-post-row="third"]')
      ?.dispatchEvent(new Event("mouseenter"));
    expect(root.querySelector("[data-preview-title]")?.textContent).toBe("third");
    expect(root.querySelector("[data-preview-summary]")?.textContent).toBe("third summary");
    expect(root.querySelector<HTMLAnchorElement>("[data-preview-link]")?.getAttribute("href")).toBe(
      "/posts/third/",
    );
    expect(root.querySelector<HTMLImageElement>("[data-preview-image]")?.src).toContain(
      "/third-800.webp",
    );
    expect(root.querySelector<HTMLImageElement>("[data-preview-image]")).toMatchObject({
      width: 900,
      height: 1200,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps preview links aligned with keyboard and filter selection", () => {
    const third = root.querySelector<HTMLElement>('[data-post-row="third"]')!;
    third.focus();
    third.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(root.querySelector<HTMLAnchorElement>("[data-preview-link]")?.getAttribute("href")).toBe(
      "/posts/second/",
    );

    button("按年份筛选文章", "2025").click();
    expect(root.querySelector<HTMLAnchorElement>("[data-preview-link]")?.getAttribute("href")).toBe(
      "/posts/third/",
    );
    expect(root.querySelector("[data-preview-related]")?.textContent).toBe("first");
  });

  it.each([
    ["first", "third", "ArrowDown"],
    ["third", "first", "ArrowUp"],
  ])("moves from the focused %s row when hovering %s and pressing %s", (focused, hovered, key) => {
    const focusedRow = root.querySelector<HTMLElement>(`[data-post-row="${focused}"]`)!;
    focusedRow.focus();
    root
      .querySelector<HTMLElement>(`[data-post-row="${hovered}"]`)!
      .dispatchEvent(new Event("mouseenter"));

    focusedRow.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    expect(document.activeElement).toBe(root.querySelector('[data-post-row="second"]'));
    expect(root.querySelector("[data-preview-title]")?.textContent).toBe("second");
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
