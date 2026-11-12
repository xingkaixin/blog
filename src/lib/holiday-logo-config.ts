import { z } from "astro/zod";
import configuration from "../../config/holiday-logos.json";
import { isCalendarDate } from "./calendar-date";
import { holidayLogos } from "./holiday-logos";

const logoId = z.enum(holidayLogos.map(({ id }) => id));
const monthDay = z
  .string()
  .regex(/^\d{2}-\d{2}$/)
  .refine((value) => isCalendarDate(`2000-${value}`), "Invalid month and day");
const dates = z.partialRecord(logoId, monthDay);
export const holidayCalendarSchema = z.object({
  timeZone: z.literal("Asia/Shanghai"),
  fixedDates: dates,
  annualDates: z.record(z.string().regex(/^\d{4}$/), dates).superRefine((years, context) => {
    for (const [year, entries] of Object.entries(years)) {
      for (const [id, date] of Object.entries(entries)) {
        if (!isCalendarDate(`${year}-${date}`)) {
          context.addIssue({ code: "custom", path: [year, id], message: "Invalid calendar date" });
        }
      }
    }
  }),
  priorities: z.partialRecord(logoId, z.number().finite()),
  disabled: z.array(logoId),
  sources: z.record(z.string(), z.url()),
});

export const validatedHolidayCalendar = holidayCalendarSchema.parse(configuration);
