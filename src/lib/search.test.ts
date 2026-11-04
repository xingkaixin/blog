import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSearchIndex, rankPosts, resetSearchCache, type SearchIndexItem } from "@/lib/search";

const posts: SearchIndexItem[] = [
  {
    slug: "alpha",
    title: "Vite 内容索引",
    date: "2026-03-11",
    summary: "讲 Markdown 扫描和构建期索引。",
    tags: ["vite", "content"],
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

  it("requires every query term to match", () => {
    expect(rankPosts(posts, { query: "vite missing" })).toEqual([]);
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
});
