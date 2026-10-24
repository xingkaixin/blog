import { describe, expect, it } from "vitest";
import { elapsedSince, pickRandom } from "@/lib/record-shuffle";

describe("record shuffle", () => {
  it.each([
    { date: "2025-10-25", expected: "1 年前" },
    { date: "2025-10-26", expected: "11 个月前" },
    { date: "2013-07-12", expected: "13 年前" },
    { date: "2026-09-25", expected: "1 个月前" },
    { date: "2026-10-01", expected: "不久前" },
  ])("labels $date as $expected", ({ date, expected }) => {
    expect(elapsedSince(date, new Date(2026, 9, 25))).toBe(expected);
  });

  it("never repeats the current record when another one exists", () => {
    expect(pickRandom(["a", "b"], "a", () => 0)).toBe("b");
    expect(pickRandom(["a"], "a", () => 0)).toBe("a");
  });
});
