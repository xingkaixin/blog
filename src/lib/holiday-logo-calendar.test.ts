import { describe, expect, it } from "vitest";
import { holidayCalendar, holidayDateAt, holidayEvents, holidayOn } from "./holiday-logo-calendar";
import { holidayCalendarSchema } from "./holiday-logo-config";

describe("holiday logo calendar", () => {
  it("uses the Shanghai calendar date at the day boundary", () => {
    expect(holidayOn(holidayDateAt(new Date("2026-12-04T15:59:59Z")))).toBeUndefined();
    expect(holidayOn(holidayDateAt(new Date("2026-12-04T16:00:00Z")))?.id).toBe("birthday");
  });

  it("uses each year's maintained dates and keeps the three birthdays fixed", () => {
    expect(holidayOn("2026-03-20")?.id).toBe("spring-equinox");
    expect(holidayOn("2027-03-21")?.id).toBe("spring-equinox");
    expect(holidayOn("2027-03-20")).toBeUndefined();
    for (const year of ["2026", "2027"]) {
      expect(holidayOn(`${year}-05-04`)?.id).toBe("father-birthday");
      expect(holidayOn(`${year}-07-12`)?.id).toBe("mother-birthday");
      expect(holidayOn(`${year}-12-05`)?.id).toBe("birthday");
    }
  });

  it("does not reuse annual dates for an unconfigured year", () => {
    const events = holidayEvents("2028");
    expect(events.every(({ id }) => id in holidayCalendar.fixedDates)).toBe(true);
    expect(holidayOn("2028-12-05")?.id).toBe("birthday");
    expect(holidayOn("2028-03-21")).toBeUndefined();
  });

  it("resolves same-day priority and skips disabled logos", () => {
    const calendar = {
      ...holidayCalendar,
      fixedDates: { ...holidayCalendar.fixedDates, newyear: "12-05" },
    };
    expect(holidayOn("2026-12-05", calendar)?.id).toBe("birthday");
    expect(holidayOn("2026-12-05", { ...calendar, disabled: ["birthday"] })?.id).toBe("newyear");
  });

  it("rejects misspelled logo IDs and impossible annual dates before building", () => {
    expect(
      holidayCalendarSchema.safeParse({ ...holidayCalendar, sources: {}, disabled: ["birthady"] })
        .success,
    ).toBe(false);
    expect(
      holidayCalendarSchema.safeParse({
        ...holidayCalendar,
        sources: {},
        annualDates: { 2027: { spring: "02-29" } },
      }).success,
    ).toBe(false);
  });
});
