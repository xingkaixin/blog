import { describe, expect, it } from "vitest";
import { buildPostTaxonomy } from "@/lib/post-tags";

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
});
