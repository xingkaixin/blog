export type DayPart = "morning" | "day" | "noon" | "evening" | "night";

/** logo 是在和访客打招呼，时段按访客本地时间划分，不跟首页的上海时间走。 */
export function dayPartAt(date: Date): DayPart {
  const hour = date.getHours();
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
