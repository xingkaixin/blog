import { describe, expect, it } from "vitest";
import { formatDate, textUnits, wrapText } from "./generate-og-images";

describe("OG image text layout", () => {
  it("accounts for CJK, Latin, and whitespace widths", () => {
    expect(textUnits("中A ")).toBeCloseTo(1.91);
  });

  it("wraps text at the configured width", () => {
    expect(wrapText("ABC", 1.12, 3)).toEqual(["AB", "C"]);
    expect(wrapText("中文A", 2, 3)).toEqual(["中文", "A"]);
  });

  it("marks truncated final lines with an ellipsis", () => {
    expect(wrapText("ABCDE", 1.12, 2)).toEqual(["AB", "CD..."]);
  });

  it("formats dates for the Chinese OG template", () => {
    expect(formatDate("2026-07-16")).toBe("2026年7月16日");
  });
});
