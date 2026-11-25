import { describe, expect, it } from "vitest";
import { shouldTriggerArticleFooterReveal } from "./article-footer-trigger";

describe("shouldTriggerArticleFooterReveal", () => {
  it("stays false when less than 50% of the footer height is visible", () => {
    expect(
      shouldTriggerArticleFooterReveal({
        top: 660,
        bottom: 1060,
        height: 400,
        viewportHeight: 800,
        scrollY: 1200,
        scrollHeight: 2400,
      }),
    ).toBe(false);
  });

  it("triggers once visible footer height reaches 50%", () => {
    expect(
      shouldTriggerArticleFooterReveal({
        top: 600,
        bottom: 1000,
        height: 400,
        viewportHeight: 800,
        scrollY: 1400,
        scrollHeight: 2400,
      }),
    ).toBe(true);
  });

  it("triggers at page bottom on short viewports where 50% cannot fit", () => {
    expect(
      shouldTriggerArticleFooterReveal({
        top: 220,
        bottom: 620,
        height: 400,
        viewportHeight: 360,
        scrollY: 1640,
        scrollHeight: 2000,
      }),
    ).toBe(true);
  });

  it("stays false when the footer is completely offscreen even near bottom", () => {
    expect(
      shouldTriggerArticleFooterReveal({
        top: 900,
        bottom: 1300,
        height: 400,
        viewportHeight: 800,
        scrollY: 1200,
        scrollHeight: 2000,
      }),
    ).toBe(false);
  });
});
