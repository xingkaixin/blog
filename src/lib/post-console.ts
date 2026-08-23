import type { PublishedPost } from "./published-post";
import type { ReadingMetrics } from "./reading-metrics";

export type PostConsoleItem = PublishedPost & ReadingMetrics;

export type PostConsoleFilter = {
  year: string | null;
  tag: string | null;
};

export function matchesPostConsoleFilter(
  post: Pick<PostConsoleItem, "date" | "tags">,
  filter: PostConsoleFilter,
): boolean {
  return (
    (!filter.year || post.date.startsWith(filter.year)) &&
    (!filter.tag || post.tags.includes(filter.tag))
  );
}

export function relatedPostConsoleItems<T extends Pick<PublishedPost, "slug" | "tags">>(
  posts: T[],
  post: T,
  limit = 2,
): T[] {
  const tags = new Set(post.tags);
  return posts
    .filter(
      (candidate) => candidate.slug !== post.slug && candidate.tags.some((tag) => tags.has(tag)),
    )
    .slice(0, limit);
}
