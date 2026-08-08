import { describe, expect, it } from "vitest";
import { comparePublishedPostsNewestFirst } from "@/lib/published-post";

describe("published post order", () => {
  it("orders equal dates by slug independently of discovery order", () => {
    const posts = [
      { slug: "z-last", date: "2026-04-17" },
      { slug: "newest", date: "2026-04-18" },
      { slug: "a-first", date: "2026-04-17" },
    ];

    expect(posts.toSorted(comparePublishedPostsNewestFirst).map((post) => post.slug)).toEqual([
      "newest",
      "a-first",
      "z-last",
    ]);
  });
});
