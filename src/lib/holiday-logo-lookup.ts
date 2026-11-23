import configuration from "../../config/holiday-logos.json";
import type { HolidayLogoId } from "./holiday-logos";

export type HolidayLookupCalendar = {
  timeZone: string;
  fixedDates: Partial<Record<HolidayLogoId, string>>;
  annualDates: Record<string, Partial<Record<HolidayLogoId, string>>>;
  priorities: Partial<Record<HolidayLogoId, number>>;
  disabled: readonly HolidayLogoId[];
};

export const holidayLookupCalendar: HolidayLookupCalendar = {
  timeZone: configuration.timeZone,
  fixedDates: configuration.fixedDates,
  annualDates: configuration.annualDates,
  priorities: configuration.priorities,
  disabled: configuration.disabled,
};

const calendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: holidayLookupCalendar.timeZone,
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

export function holidayLogoUrl(id: HolidayLogoId, dark = false): string {
  return `/holiday-logos/${id}${dark ? "-dark" : ""}.svg`;
}

export function holidayIdOn(
  date: string,
  calendar: HolidayLookupCalendar = holidayLookupCalendar,
): HolidayLogoId | undefined {
  const year = date.slice(0, 4);
  const monthDay = date.slice(5);
  const annual = calendar.annualDates[year];
  let bestId: HolidayLogoId | undefined;
  let bestPriority = -Infinity;

  const check = (id: HolidayLogoId, candidate: string | undefined) => {
    if (candidate !== monthDay || calendar.disabled.includes(id)) {
      return;
    }
    const priority = calendar.priorities[id] ?? 10;
    if (priority > bestPriority) {
      bestPriority = priority;
      bestId = id;
    }
  };

  for (const [id, md] of Object.entries(calendar.fixedDates)) {
    check(id as HolidayLogoId, md);
  }
  if (annual) {
    for (const [id, md] of Object.entries(annual)) {
      if (!(id in calendar.fixedDates)) {
        check(id as HolidayLogoId, md);
      }
    }
  }
  return bestId;
}
