// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PostConsole, type PostConsoleItem } from "./post-console";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const posts: PostConsoleItem[] = [
  {
    slug: "first",
    title: "第一篇",
    date: "2026-02-02",
    summary: "第一篇摘要",
    tags: ["AI"],
    cover: "2026-chiangmai-trip.png",
    coverAlt: "第一篇封面",
    wordCount: 100,
    readingMinutes: 1,
  },
  {
    slug: "second",
    title: "第二篇",
    date: "2026-01-01",
    summary: "第二篇摘要",
    tags: ["生活"],
    cover: "315-geo-ai-poisoning.png",
    coverAlt: "第二篇封面",
    wordCount: 200,
    readingMinutes: 2,
  },
  {
    slug: "third",
    title: "第三篇",
    date: "2025-12-31",
    summary: "第三篇摘要",
    tags: ["AI"],
    cover: "2025-review.webp",
    coverAlt: "第三篇封面",
    wordCount: 300,
    readingMinutes: 3,
  },
];

let root: Root;
let container: HTMLDivElement;

function button(groupLabel: string, label: string): HTMLButtonElement {
  const group = container.querySelector<HTMLElement>(`[aria-label="${groupLabel}"]`);
  const match = [...(group?.querySelectorAll("button") ?? [])].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`找不到筛选按钮 ${label}`);
  }
  return match;
}

function visiblePostSlugs(): string[] {
  return [...container.querySelectorAll<HTMLElement>("[data-post-row]")].map(
    (element) => element.dataset.postRow ?? "",
  );
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<PostConsole posts={posts} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("PostConsole", () => {
  it("keeps mobile and desktop filters on the same state", async () => {
    await act(async () => button("按年份筛选文章", "2025").click());
    expect(visiblePostSlugs()).toEqual(["third"]);

    const yearGroups = container.querySelectorAll<HTMLElement>('[aria-label="按年份筛选文章"]');
    expect(yearGroups).toHaveLength(2);
    expect(
      [...yearGroups].every((group) =>
        group
          .querySelector<HTMLButtonElement>('[aria-pressed="true"]')
          ?.textContent?.includes("2025"),
      ),
    ).toBe(true);

    await act(async () => button("按年份筛选文章", "全部年份").click());
    await act(async () => button("按标签筛选文章", "AI").click());
    expect(visiblePostSlugs()).toEqual(["first", "third"]);
  });
});
