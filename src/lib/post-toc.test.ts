import { describe, expect, it } from "vitest";
import { tocFromHeadings } from "@/lib/post-toc";

describe("tocFromHeadings", () => {
  it("includes second- and third-level headings", () => {
    expect(
      tocFromHeadings([
        { depth: 1, text: "正文一级标题" },
        { depth: 2, text: "起点" },
        { depth: 3, text: "第二层" },
        { depth: 4, text: "细节" },
      ]),
    ).toEqual([
      { depth: 2, text: "起点", id: "起点" },
      { depth: 3, text: "第二层", id: "第二层" },
    ]);
  });

  it("shares duplicate ids with the content renderer", () => {
    expect(
      tocFromHeadings([
        { depth: 2, text: "重复标题" },
        { depth: 3, text: "重复标题" },
      ]),
    ).toEqual([
      { depth: 2, text: "重复标题", id: "重复标题" },
      { depth: 3, text: "重复标题", id: "重复标题-2" },
    ]);
  });

  it("allocates a fallback id for headings without letters or numbers", () => {
    expect(
      tocFromHeadings([
        { depth: 2, text: "✨" },
        { depth: 2, text: "✨" },
      ]),
    ).toEqual([
      { depth: 2, text: "✨", id: "section" },
      { depth: 2, text: "✨", id: "section-2" },
    ]);
  });
});
