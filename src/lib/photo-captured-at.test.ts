import { describe, expect, it } from "vitest";
import { formatPhotoCapturedAt } from "@/lib/photo-captured-at";

describe("photo captured-at formatting", () => {
  it("preserves the photographed local date and time", () => {
    expect(formatPhotoCapturedAt("2026-04-05T09:07:30.244+07:00")).toBe("2026年4月5日 09:07");
  });
});
