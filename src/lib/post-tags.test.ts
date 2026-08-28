import { describe, expect, it } from "vitest";
import { buildPostTaxonomy, relatedPosts, tagHref, tagSlug } from "@/lib/post-tags";

describe("tag archives", () => {
  it("keeps tags shared by at least two posts", () => {
    const taxonomy = buildPostTaxonomy([
      { slug: "one", tags: ["shared", "single"] },
      { slug: "two", tags: ["shared"] },
    ]);

    expect(taxonomy.archives).toEqual([
      { tag: "shared", href: "/tags/shared/", posts: expect.any(Array) },
    ]);
    expect(taxonomy.archives[0]?.posts).toHaveLength(2);
    expect(taxonomy.tags).toEqual([
      { tag: "shared", count: 2, href: "/tags/shared/" },
      { tag: "single", count: 1, href: null },
    ]);
  });

  it("keeps related posts in catalog order and applies the requested limit", () => {
    const first = { slug: "one", tags: ["shared"] };
    const second = { slug: "two", tags: ["shared", "other"] };
    const unrelated = { slug: "three", tags: ["other"] };
    const fourth = { slug: "four", tags: ["shared"] };
    const posts = [first, second, unrelated, fourth];

    expect(relatedPosts(posts, first)).toEqual([second, fourth]);
    expect(relatedPosts(posts, first, 1)).toEqual([second]);
    expect(relatedPosts(posts, first, 0)).toEqual([]);
  });

  it("encodes tag route segments", () => {
    expect(tagHref("Claude Code")).toBe("/tags/Claude%20Code/");
    expect(tagHref("AI 编程")).toBe("/tags/AI%E7%BC%96%E7%A8%8B/");
  });

  it("gives reserved tag names distinct, stable path segments", () => {
    const tags = ["100%", "%25", "C/C++", "C++", "A?#", ".", "..", "~31303025", "a\\b"];
    const slugs = tags.map(tagSlug);
    expect(new Set(slugs).size).toBe(tags.length);
    expect(tagHref("100%")).toBe("/tags/~31303025/");
    for (const [index, tag] of tags.entries()) {
      const slug = slugs[index];
      expect(slug).toMatch(/^~[0-9a-f]+$/);
      expect(Buffer.from(slug.slice(1), "hex").toString("utf8")).toBe(tag);
      expect(new URL(tagHref(tag), "https://example.com").pathname).toBe(`/tags/${slug}/`);
    }
  });
});
