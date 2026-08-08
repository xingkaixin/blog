const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function toPublishedPost(slug: string, post: PublishablePost): PublishedPost {
  return {
    slug,
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

export function parsePublishedPosts(value: unknown): PublishedPost[] {
  if (!Array.isArray(value)) {
    throw new Error("searchIndex must be an array");
  }
  return value.map((entry, index) => parsePublishedPost(entry, `searchIndex[${index}]`));
}

function parsePublishedPost(value: unknown, field: string): PublishedPost {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }

  const entry = value as Record<string, unknown>;
  const tags = readTags(entry.tags, `${field}.tags`);
  const date = readString(entry.date, `${field}.date`);
  if (!isCalendarDate(date)) {
    throw new Error(`${field}.date must be a valid YYYY-MM-DD calendar date`);
  }

  return {
    slug: readString(entry.slug, `${field}.slug`),
    title: readString(entry.title, `${field}.title`),
    date,
    summary: readString(entry.summary, `${field}.summary`),
    tags,
    cover: readString(entry.cover, `${field}.cover`),
    coverAlt: readString(entry.coverAlt, `${field}.coverAlt`),
  };
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function readTags(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  const tags = value.map((tag, index) => readString(tag, `${field}[${index}]`));
  if (new Set(tags).size !== tags.length) {
    throw new Error(`${field} must contain unique values`);
  }
  return tags;
}
