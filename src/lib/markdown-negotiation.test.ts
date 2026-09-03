import { describe, expect, it } from "vitest";
import { markdownPathForPage, prefersMarkdown } from "./markdown-negotiation";

describe("markdown negotiation", () => {
  it.each([
    ["text/markdown", true],
    ["text/html, text/markdown", false],
    ["text/html;q=0.7, text/markdown;q=0.8", true],
    ["text/markdown;q=0, */*;q=1", false],
    ["text/markdown;q=invalid", false],
    ["*/*", false],
    [null, false],
  ])("selects the preferred response for %s", (accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected);
  });

  it.each([
    ["/", "/index.md"],
    ["/about/", "/about/index.md"],
    ["/about", "/about.md"],
  ])("maps %s to %s", (pathname, expected) => {
    expect(markdownPathForPage(pathname)).toBe(expected);
  });
});
