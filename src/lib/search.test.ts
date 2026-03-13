import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadSearchIndex, resetSearchCache, type SearchIndexItem } from "@/lib/search";

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
  beforeEach(() => {
    vi.resetAllMocks();
    resetSearchCache();
  });

  it("matches title and body terms", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => posts,
    } as Response);

    const { searchPosts } = await import("@/lib/search");
    const results = await searchPosts({ query: "vite", activeTag: null });
    expect(results[0]?.slug).toBe("alpha");
  });

  it("filters by tag", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => posts,
    } as Response);

    const { searchPosts } = await import("@/lib/search");
    const results = await searchPosts({ query: "", activeTag: "reading" });
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("beta");
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

  it("returns empty array on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
    } as Response);

    const result = await loadSearchIndex();
    expect(result).toEqual([]);
  });
});
