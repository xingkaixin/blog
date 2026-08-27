import { describe, expect, it } from "vitest";
import { tocFromHeadings } from "@/lib/post-toc";

describe("tocFromHeadings", () => {
  it("includes second- and third-level headings", () => {
    expect(
      tocFromHeadings([
        { depth: 1, text: "正文一级标题", slug: "title" },
        { depth: 2, text: "起点", slug: "起点" },
        { depth: 3, text: "第二层", slug: "第二层" },
        { depth: 4, text: "细节", slug: "细节" },
      ]),
    ).toEqual([
      { depth: 2, text: "起点", id: "起点" },
      { depth: 3, text: "第二层", id: "第二层" },
    ]);
  });

  it("uses rendered slugs without reallocating ids from heading text", () => {
    expect(
      tocFromHeadings([
        { depth: 2, text: "重复标题", slug: "rendered-heading" },
        { depth: 3, text: "重复标题", slug: "rendered-heading-3" },
        { depth: 2, text: "✨", slug: "section-2" },
      ]),
    ).toEqual([
      { depth: 2, text: "重复标题", id: "rendered-heading" },
      { depth: 3, text: "重复标题", id: "rendered-heading-3" },
      { depth: 2, text: "✨", id: "section-2" },
    ]);
  });
});
