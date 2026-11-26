import type { Locale } from "./i18n";
import { postsMessages } from "./messages/posts";

// 最新的几篇已经排在文章列表顶部，唱片只从更早的文章里挑
const RECENT_POSTS_SKIPPED = 10;

export function shuffleablePosts<T>(postsNewestFirst: T[]): T[] {
  return postsNewestFirst.slice(RECENT_POSTS_SKIPPED);
}

export function pickRandom<T>(items: T[], current?: T, random = Math.random): T | undefined {
  const candidates = items.length > 1 ? items.filter((item) => item !== current) : items;
  return candidates[Math.floor(random() * candidates.length)];
}

export function elapsedSince(date: string, now: Date, locale: Locale = "zh"): string {
  const t = postsMessages[locale].shuffle;
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  const months =
    (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) - (now.getDate() < day ? 1 : 0);
  if (months >= 12) {
    return t.yearsAgo(Math.floor(months / 12));
  }
  return months >= 1 ? t.monthsAgo(months) : t.recently;
}
