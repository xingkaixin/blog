import { describe, expect, it } from "vitest";
import { comparePublishedPostsNewestFirst, parsePostSlug, postHref } from "@/lib/published-post";

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

describe("post slug", () => {
  it("preserves historical case and underscores", () => {
    expect(parsePostSlug("The_state-2025")).toBe("The_state-2025");
    expect(postHref("The_state-2025")).toBe("/posts/The_state-2025/");
  });

  it.each(["two words", "c&c", "percent%", "line\nbreak", "中文"])(
    "rejects unsafe slug %j",
    (slug) => {
      expect(() => parsePostSlug(slug)).toThrow("ASCII letters");
    },
  );
});
