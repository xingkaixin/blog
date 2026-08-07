import { describe, expect, it } from "vitest";
import { postFrontmatterSchema } from "@/lib/post-schema";

const validFrontmatter = {
  title: "测试文章",
  date: "2026-08-07",
  summary: "测试摘要",
  tags: ["Astro", "TypeScript"],
  cover: "/posts/cover/test.png",
  coverAlt: "测试封面",
};

describe("post frontmatter", () => {
  it("keeps a calendar date as a string", () => {
    expect(postFrontmatterSchema.parse(validFrontmatter).date).toBe("2026-08-07");
  });

  it.each(["2026-02-29", "2026-13-01", "2026-8-7", "August 7, 2026", 20260807])(
    "rejects non-calendar date %j",
    (date) => {
      expect(postFrontmatterSchema.safeParse({ ...validFrontmatter, date }).success).toBe(false);
    },
  );

  it("trims tags and rejects duplicates after normalization", () => {
    expect(
      postFrontmatterSchema.parse({ ...validFrontmatter, tags: [" Astro ", "TypeScript"] }).tags,
    ).toEqual(["Astro", "TypeScript"]);
    expect(
      postFrontmatterSchema.safeParse({ ...validFrontmatter, tags: ["Astro", " Astro "] }).success,
    ).toBe(false);
  });

  it("rejects empty tags", () => {
    expect(postFrontmatterSchema.safeParse({ ...validFrontmatter, tags: [" "] }).success).toBe(
      false,
    );
  });
});
