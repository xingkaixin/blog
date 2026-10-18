// 12–2 月为冬，之后每三个月一季，按 (月份 % 12) / 3 取下标
const seasons = ["winter", "spring", "summer", "autumn"] as const;

export type Season = (typeof seasons)[number];

const shanghaiMonth = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
});

/** 首页讲的是上海的客厅，季节按上海当地月份划分，不随访客所在半球变化。 */
export function seasonAt(date: Date): Season {
  return seasons[Math.floor((Number(shanghaiMonth.format(date)) % 12) / 3)];
}

export function isSeason(value: unknown): value is Season {
  return typeof value === "string" && (seasons as readonly string[]).includes(value);
}
