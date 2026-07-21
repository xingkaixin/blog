import { describe, expect, it } from "vitest";
import { formatDate } from "./generate-og-images";

describe("OG image text layout", () => {
  it("formats dates for the Chinese OG template", () => {
    expect(formatDate("2026-07-16")).toBe("2026年7月16日");
  });
});
