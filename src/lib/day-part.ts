export type DayPart = "morning" | "day" | "noon" | "evening" | "night";

const DAY_MINUTES = 1440;

export function dayPartFromMinutes(totalMinutes: number): DayPart {
  const normalized = ((Math.floor(totalMinutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hour = Math.floor(normalized / 60);
  if (hour < 5 || hour >= 23) {
    return "night";
  }
  if (hour < 9) {
    return "morning";
  }
  if (hour >= 12 && hour < 14) {
    return "noon";
  }
  if (hour >= 18) {
    return "evening";
  }
  return "day";
}

/** logo 是在和访客打招呼，时段按访客本地时间划分，不跟首页的上海时间走。 */
export function dayPartAt(date: Date): DayPart {
  return dayPartFromMinutes(date.getHours() * 60 + date.getMinutes());
}

export function nextDayPartDelayMs(date: Date): number {
  const boundaries = [5, 9, 12, 14, 18, 23];
  const hour = date.getHours();
  const nextBoundary = boundaries.find((boundary) => boundary > hour);
  const next = new Date(date);
  if (nextBoundary !== undefined) {
    next.setHours(nextBoundary, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(5, 0, 0, 0);
  }
  return Math.max(1000, next.getTime() - date.getTime());
}
