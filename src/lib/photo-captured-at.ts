import type { Locale } from "./i18n";

const englishMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatPhotoCapturedAt(capturedAt: string, locale: Locale = "zh"): string {
  const [date, timeWithOffset] = capturedAt.split("T");
  const [year, month, day] = date.split("-");
  const time = timeWithOffset.slice(0, 5);
  return locale === "en"
    ? `${englishMonths[Number(month) - 1]} ${Number(day)}, ${year} ${time}`
    : `${year}年${Number(month)}月${Number(day)}日 ${time}`;
}

/** 把 YYYY-MM 格式的拍摄月份写成「2026年8月」或「Aug 2026」。 */
export function formatCaptureMonth(month: string, locale: Locale = "zh"): string {
  const [year, monthNumber] = month.split("-");
  return locale === "en"
    ? `${englishMonths[Number(monthNumber) - 1]} ${year}`
    : `${year}年${Number(monthNumber)}月`;
}
