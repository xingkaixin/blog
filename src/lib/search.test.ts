import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSearchIndex, rankPosts, resetSearchCache, type SearchIndexItem } from "@/lib/search";

const posts: SearchIndexItem[] = [
  {
    slug: "alpha",
    title: "Vite 内容索引",
    date: "2026-03-11",
    summary: "讲 Markdown 扫描和构建期索引。",
    tags: ["vite", "content"],
    cover: "alpha.jpg",
    coverAlt: "alpha cover",
  },
  {
    slug: "beta",
    title: "阅读节奏",
    date: "2026-03-10",
    summary: "关于长期阅读的笔记。",
    tags: ["reading"],
    cover: "beta.jpg",
    coverAlt: "beta cover",
  },
];

describe("search posts", () => {
  it("matches title and body terms", () => {
    const results = rankPosts(posts, { query: "vite" });
    expect(results[0]?.slug).toBe("alpha");
  });

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

  it("loads search index from JSON file", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => posts,
    } as Response);

    const result = await loadSearchIndex();
    expect(result).toEqual(posts);
  });

  it("deduplicates concurrent loads", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetch = vi.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );

    const first = loadSearchIndex();
    const second = loadSearchIndex();
    resolveResponse?.({ ok: true, json: async () => posts } as Response);

    await expect(Promise.all([first, second])).resolves.toEqual([posts, posts]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(loadSearchIndex()).rejects.toThrow("Failed to load search index: 503");
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

  it("rejects malformed generated entries", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [{ ...posts[0], date: "2026-02-30" }],
    } as Response);

    await expect(loadSearchIndex()).rejects.toThrow("searchIndex[0].date");
  });
});
