import { describe, expect, it } from "vitest";
import { searchPosts } from "@/lib/search";
import type { PostDetail } from "@/lib/content";

const posts: PostDetail[] = [
  {
    slug: "alpha",
    title: "Vite 内容索引",
    date: "2026-03-11",
    summary: "讲 Markdown 扫描和构建期索引。",
    tags: ["vite", "content"],
    cover: "/posts/alpha/cover.svg",
    coverAlt: "alpha cover",
    readingTime: 4,
    content: "",
    plainText: "使用 vite 和 markdown 建索引",
    toc: [],
  },
  {
    slug: "beta",
    title: "阅读节奏",
    date: "2026-03-10",
    summary: "关于长期阅读的笔记。",
    tags: ["reading"],
    cover: "/posts/beta/cover.svg",
    coverAlt: "beta cover",
    readingTime: 3,
    content: "",
    plainText: "日常阅读和做笔记",
    toc: [],
  },
];

describe("search posts", () => {
  it("matches title and body terms", () => {
    const results = searchPosts(posts, { query: "vite", activeTag: null });
    expect(results[0]?.slug).toBe("alpha");
  });

  it("filters by tag", () => {
    const results = searchPosts(posts, { query: "", activeTag: "reading" });
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("beta");
  });
});
