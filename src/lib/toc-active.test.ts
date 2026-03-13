import { describe, expect, it } from "vitest";
import { TOC_ACTIVE_OFFSET, resolveActiveTocId } from "@/lib/toc-active";

function createHeading(id: string, top: number) {
  return {
    id,
    getBoundingClientRect: () => ({ top }),
  };
}

describe("resolveActiveTocId", () => {
  it("defaults to the first heading before the reader reaches the article body", () => {
    const headings = [createHeading("intro", 180), createHeading("details", 520)];

    expect(resolveActiveTocId(headings, TOC_ACTIVE_OFFSET)).toBe("intro");
  });

  it("keeps the last heading that has crossed the top offset", () => {
    const headings = [
      createHeading("intro", -24),
      createHeading("details", 96),
      createHeading("summary", 460),
    ];

    expect(resolveActiveTocId(headings, TOC_ACTIVE_OFFSET)).toBe("details");
  });

  it("sticks to the last heading after the reader scrolls past the end", () => {
    const headings = [createHeading("intro", -320), createHeading("summary", -40)];

    expect(resolveActiveTocId(headings, TOC_ACTIVE_OFFSET)).toBe("summary");
  });
});
