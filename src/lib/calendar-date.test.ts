import { describe, expect, it } from "vitest";
import { formatCalendarDate, isCalendarDate } from "@/lib/calendar-date";

describe("isCalendarDate", () => {
  it("accepts valid dates including leap days", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-08-23")).toBe(true);
  });

  it("rejects invalid dates and formats", () => {
    expect(isCalendarDate("2025-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-8-23")).toBe(false);
  });
});

describe("formatCalendarDate", () => {
  it("formats a calendar date in Chinese without timezone conversion", () => {
    expect(formatCalendarDate("2026-07-16")).toBe("2026年7月16日");
  });

  it("rejects invalid calendar dates", () => {
    expect(() => formatCalendarDate("2026-02-30")).toThrow("Invalid calendar date: 2026-02-30");
  });
});
