import type { Locale } from "./i18n";
import { postsMessages } from "./messages/posts";
import type { PublishedPost } from "./published-post";
import type { ReadingMetrics } from "./reading-metrics";

export type PostConsoleItem = PublishedPost & ReadingMetrics;

export type PostConsoleFilter = {
  year: string | null;
  tag: string | null;
};

export function postPreviewContent(
  post: Pick<PostConsoleItem, "wordCount" | "readingMinutes" | "tags">,
  cover: { mobile: string; desktop: string; mobileAvif?: string; desktopAvif?: string },
  locale: Locale = "zh",
) {
  const t = postsMessages[locale].console;
  return {
    coverSrcSet: `${cover.mobile} 1x, ${cover.desktop} 2x`,
    coverAvifSrcSet:
      cover.mobileAvif && cover.desktopAvif
        ? `${cover.mobileAvif} 1x, ${cover.desktopAvif} 2x`
        : "",
    wordCount: t.wordCount(post.wordCount),
    readingMinutes: t.readingMinutesShort(post.readingMinutes),
    tags: post.tags.join(" · "),
  };
}

export function matchesPostConsoleFilter(
  post: Pick<PostConsoleItem, "date" | "tags">,
  filter: PostConsoleFilter,
): boolean {
  return (
    (!filter.year || post.date.startsWith(filter.year)) &&
    (!filter.tag || post.tags.includes(filter.tag))
  );
}

export function groupPostsByMonth<T extends Pick<PostConsoleItem, "date">>(
  posts: T[],
  locale: Locale = "zh",
) {
  const t = postsMessages[locale].console;
  const months: Array<{ key: string; label: string; posts: T[] }> = [];
  for (const post of posts) {
    const key = post.date.slice(0, 7);
    const current = months.at(-1);
    if (current?.key === key) {
      current.posts.push(post);
    } else {
      months.push({
        key,
        label: t.monthLabel(key.slice(0, 4), Number(key.slice(5))),
        posts: [post],
      });
    }
  }
  return months;
}
