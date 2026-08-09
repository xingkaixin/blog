import { describe, expect, it } from "vitest";
import { canonicalTag } from "@/lib/post-tag";

describe("canonical tags", () => {
  it("normalizes compatibility characters and whitespace", () => {
    expect(canonicalTag("  Claude\t Code  ")).toBe("Claude Code");
    expect(canonicalTag("ＡＩ")).toBe("AI");
  });

  it("resolves known equivalent labels", () => {
    expect(canonicalTag("AI 编程")).toBe("AI编程");
    expect(canonicalTag("Claude Code")).toBe("Claude Code");
  });
});
