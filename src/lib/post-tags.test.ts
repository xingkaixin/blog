import { describe, expect, it } from "vitest";
import { buildPostTaxonomy, tagHref } from "@/lib/post-tags";

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

  it("counts distinct posts rather than duplicate tag entries", () => {
    const taxonomy = buildPostTaxonomy([{ slug: "one", tags: ["duplicate", "duplicate"] }]);

    expect(taxonomy.tags).toEqual([{ tag: "duplicate", count: 1, href: null }]);
    expect(taxonomy.archives).toEqual([]);
  });

  it("finds related posts through the taxonomy", () => {
    const first = { slug: "one", tags: ["shared"] };
    const second = { slug: "two", tags: ["shared", "other"] };
    const unrelated = { slug: "three", tags: ["other"] };
    const taxonomy = buildPostTaxonomy([first, second, unrelated]);

    expect(taxonomy.relatedTo(first, 2)).toEqual([second]);
  });

  it("encodes tag route segments", () => {
    expect(tagHref("Claude Code")).toBe("/tags/Claude%20Code/");
  });
});
