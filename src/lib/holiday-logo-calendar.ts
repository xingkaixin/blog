import type { z } from "astro/zod";
import configuration from "../../config/holiday-logos.json";
import type { holidayCalendarSchema } from "./holiday-logo-config";
import { holidayLogos, type HolidayLogo } from "./holiday-logos";

export type HolidayCalendar = Omit<z.infer<typeof holidayCalendarSchema>, "sources">;

export type HolidayLogoEvent = HolidayLogo & { date: string };
export const holidayCalendar = configuration as HolidayCalendar;

const calendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: holidayCalendar.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function holidayDateAt(date = new Date()): string {
  const parts = Object.fromEntries(
    calendarFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function holidayEvents(year: string, calendar = holidayCalendar): HolidayLogoEvent[] {
  return holidayLogos
    .flatMap((logo) => {
      const monthDay = calendar.fixedDates[logo.id] ?? calendar.annualDates[year]?.[logo.id];
      return monthDay && !calendar.disabled.includes(logo.id)
        ? [{ ...logo, date: `${year}-${monthDay}` }]
        : [];
    })
    .toSorted(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (calendar.priorities[right.id] ?? 10) - (calendar.priorities[left.id] ?? 10),
    );
}

export function holidayOn(date: string, calendar = holidayCalendar): HolidayLogoEvent | undefined {
  return holidayEvents(date.slice(0, 4), calendar).find((event) => event.date === date);
}
