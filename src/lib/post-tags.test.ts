import { describe, expect, it } from "vitest";
import { buildTagArchives, tagHref } from "@/lib/post-tags";

describe("tag archives", () => {
  it("keeps tags shared by at least two posts", () => {
    const archives = buildTagArchives([{ tags: ["shared", "single"] }, { tags: ["shared"] }]);

    expect(archives).toEqual([{ tag: "shared", posts: expect.any(Array) }]);
    expect(archives[0]?.posts).toHaveLength(2);
  });

  it("encodes tag route segments", () => {
    expect(tagHref("Claude Code")).toBe("/tags/Claude%20Code/");
  });
});
