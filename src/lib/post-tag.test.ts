import { describe, expect, it } from "vitest";
import { canonicalTag } from "@/lib/post-tag";

describe("canonical tags", () => {
  it("normalizes compatibility characters and whitespace", () => {
    expect(canonicalTag("  Claude\t Code  ")).toBe("Claude Code");
    expect(canonicalTag("ＡＩ")).toBe("AI");
  });
});
