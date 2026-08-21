const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POST_SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

export type PublishedPost = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string;
  coverAlt: string;
};

type PublishablePost = Omit<PublishedPost, "slug">;

export function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function parsePostSlug(value: string, field = "slug"): string {
  if (!POST_SLUG_PATTERN.test(value)) {
    throw new Error(`${field} must contain only ASCII letters, numbers, hyphens, and underscores`);
  }
  return value;
}

export function postHref(slug: string): string {
  return `/posts/${encodeURIComponent(parsePostSlug(slug))}/`;
}

export function toPublishedPost(slug: string, post: PublishablePost): PublishedPost {
  return {
    slug: parsePostSlug(slug),
    title: post.title,
    date: post.date,
    summary: post.summary,
    tags: post.tags,
    cover: post.cover,
    coverAlt: post.coverAlt,
  };
}

export function comparePublishedPostsNewestFirst(
  left: Pick<PublishedPost, "date" | "slug">,
  right: Pick<PublishedPost, "date" | "slug">,
): number {
  if (left.date !== right.date) {
    return left.date > right.date ? -1 : 1;
  }
  if (left.slug === right.slug) {
    return 0;
  }
  return left.slug < right.slug ? -1 : 1;
}
