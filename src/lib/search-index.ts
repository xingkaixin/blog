import { canonicalTags } from "./post-tag";
import { isCalendarDate, parsePostSlug, type PublishedPost } from "./published-post";

export type SearchIndexItem = Pick<PublishedPost, "slug" | "title" | "date" | "summary" | "tags">;

export function toSearchIndexItem(post: PublishedPost): SearchIndexItem {
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    summary: post.summary,
    tags: post.tags,
  };
}

export function parseSearchIndex(value: unknown): SearchIndexItem[] {
  if (!Array.isArray(value)) {
    throw new Error("searchIndex must be an array");
  }
  return value.map((entry, index) => parseSearchIndexItem(entry, `searchIndex[${index}]`));
}

function parseSearchIndexItem(value: unknown, field: string): SearchIndexItem {
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
    slug: parsePostSlug(readString(entry.slug, `${field}.slug`), `${field}.slug`),
    title: readString(entry.title, `${field}.title`),
    date,
    summary: readString(entry.summary, `${field}.summary`),
    tags,
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
  const tags = canonicalTags(value.map((tag, index) => readString(tag, `${field}[${index}]`)));
  if (new Set(tags).size !== tags.length) {
    throw new Error(`${field} must contain unique values`);
  }
  return tags;
}
