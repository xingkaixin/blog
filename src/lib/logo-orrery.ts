import type { DayPart } from "@/lib/day-part";
import { holidayEvents } from "@/lib/holiday-logo-calendar";
import type { HolidayLogoGroup, HolidayLogoId } from "@/lib/holiday-logos";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type LogoNodeId = "seal" | HolidayLogoId;
export type LogoNodeGroup = "seal" | HolidayLogoGroup;

export type LogoNode = {
  id: LogoNodeId;
  name: string;
  group: LogoNodeGroup;
  theme: string;
  rule: string;
  description: string;
  date: string;
  shortDate: string;
  season: Season;
  fraction: number;
  targetAngle: number;
};

export const GROUP_LABELS: Record<LogoNodeGroup, string> = {
  seal: "本尊",
  season: "节气",
  traditional: "传统",
  holiday: "节日",
  personal: "家人",
};

export const DAY_PART_SPECS: readonly {
  id: DayPart;
  label: string;
  sampleMinutes: number;
  title: string;
  greeting: string;
}[] = [
  { id: "morning", label: "晨", sampleMinutes: 450, title: "晨光初醒", greeting: "早" },
  { id: "day", label: "昼", sampleMinutes: 630, title: "清昼当空", greeting: "xingkaixin.me" },
  { id: "noon", label: "午", sampleMinutes: 750, title: "正午放晴", greeting: "吃了吗" },
  { id: "evening", label: "暮", sampleMinutes: 1170, title: "日暮琥珀", greeting: "下班了" },
  { id: "night", label: "夜", sampleMinutes: 1425, title: "深夜酣眠", greeting: "还没睡？" },
];

export function seasonFromMonth(month: number): Season {
  if (month >= 3 && month <= 5) {
    return "spring";
  }
  if (month >= 6 && month <= 8) {
    return "summer";
  }
  if (month >= 9 && month <= 11) {
    return "autumn";
  }
  return "winter";
}

export function buildLogoNodes(today: string): LogoNode[] {
  const year = today.slice(0, 4);
  const numericYear = Number(year);
  const yearStart = Date.parse(`${numericYear}-01-01T00:00:00Z`);
  const yearLength = Date.parse(`${numericYear + 1}-01-01T00:00:00Z`) - yearStart;
  const todayMonth = Number(today.slice(5, 7)) || 1;

  const sealFraction = 356.5 / 360;
  const sealNode: LogoNode = {
    id: "seal",
    name: "方印本尊",
    group: "seal",
    theme: "时辰呼吸",
    rule: "随日晷变幻",
    description:
      "方寸朱印融「行·开·心」三字笔画，内藏笑眼与光芒。随一天晨昼午暮夜变幻神态，入夜整印颠倒 180°。",
    date: today,
    shortDate: "常态",
    season: seasonFromMonth(todayMonth),
    fraction: sealFraction,
    targetAngle: -(sealFraction * 360),
  };

  const eventNodes: LogoNode[] = holidayEvents(year).map((event) => {
    const fraction = Math.max(
      0,
      Math.min(1, (Date.parse(`${event.date}T00:00:00Z`) - yearStart) / yearLength),
    );
    const month = Number(event.date.slice(5, 7));
    return {
      id: event.id,
      name: event.name,
      group: event.group,
      theme: event.theme,
      rule: event.rule,
      description: event.description,
      date: event.date,
      shortDate: event.date.slice(5).replace("-", "."),
      season: seasonFromMonth(month),
      fraction,
      targetAngle: -(fraction * 360),
    };
  });

  return [sealNode, ...eventNodes];
}

export function nearestLogoNode(angle: number, nodes: LogoNode[]): LogoNode {
  const normalized = ((-angle % 360) + 360) % 360;
  let best = nodes[0];
  let bestDistance = 999;
  for (const node of nodes) {
    const nodeDeg = node.fraction * 360;
    const distance = Math.min(Math.abs(normalized - nodeDeg), 360 - Math.abs(normalized - nodeDeg));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }
  return best;
}

export function formatSundialClock(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
