import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  highlightSearchText,
  loadSearchIndex,
  matchPostSnippet,
  rankPosts,
  resetSearchCache,
  type SearchIndexItem,
} from "@/lib/search";
import { extractMarkdownHeadings } from "@/lib/search-index";

const posts: SearchIndexItem[] = [
  {
    slug: "alpha",
    title: "Vite 内容索引",
    date: "2026-03-11",
    summary: "讲 Markdown 扫描和构建期索引。",
    tags: ["vite", "content"],
    headings: ["目录扫描", "增量构建与缓存"],
  },
  {
    slug: "beta",
    title: "阅读节奏",
    date: "2026-03-10",
    summary: "关于长期阅读的笔记。",
    tags: ["reading"],
  },
];

describe("search posts", () => {
  it("matches tag terms", () => {
    const results = rankPosts(posts, { query: "reading" });
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("beta");
  });

  it("matches section headings and extracts a heading snippet", () => {
    const results = rankPosts(posts, { query: "增量构建" });
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("alpha");
    expect(matchPostSnippet(results[0], "增量构建")).toBe("§ 增量构建与缓存");
  });

  it("requires every query term to match", () => {
    expect(rankPosts(posts, { query: "vite missing" })).toEqual([]);
  });

  it("extracts h2/h3 headings while skipping fenced code blocks", () => {
    const markdown = [
      "## 第一节",
      "```md",
      "## 代码里的标题",
      "```",
      "### [带链接的小节](https://example.com)",
      "#### 四级标题不收录",
    ].join("\n");
    expect(extractMarkdownHeadings(markdown)).toEqual(["第一节", "带链接的小节"]);
  });

  it("splits text into highlighted segments case-insensitively", () => {
    expect(highlightSearchText("Vite 构建期索引", "vite 索引")).toEqual([
      { start: 0, text: "Vite", matched: true },
      { start: 4, text: " 构建期", matched: false },
      { start: 8, text: "索引", matched: true },
    ]);
  });
});

describe("loadSearchIndex", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetSearchCache();
  });

  it("retries after a failed request", async () => {
    const fetch = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => posts } as Response);

    await expect(loadSearchIndex()).rejects.toThrow("503");
    await expect(loadSearchIndex()).resolves.toEqual(posts);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("loads locale-specific search indexes independently", async () => {
    const fetch = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, json: async () => posts } as Response);

    await loadSearchIndex("en");
    expect(fetch).toHaveBeenCalledWith("/search-index-en.json", { cache: "no-cache" });
  });
});
