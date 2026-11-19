import { isCalendarDate } from "./calendar-date";
import { canonicalTags } from "./post-tag";
import { normalizeHeadingText } from "./post-toc";
import { parsePostSlug, type PublishedPost } from "./published-post";

export type SearchIndexItem = Pick<
  PublishedPost,
  "slug" | "title" | "date" | "summary" | "tags"
> & {
  headings?: string[];
};

const HEADING_LINE = /^#{2,3}\s+(.+?)\s*#*$/;
const CODE_FENCE = /^(`{3,}|~{3,})/;

export function extractMarkdownHeadings(body: string): string[] {
  const headings: string[] = [];
  const seen = new Set<string>();
  let fenceMarker: string | null = null;

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    const fence = CODE_FENCE.exec(trimmed);
    if (fence) {
      if (fenceMarker === null) {
        fenceMarker = fence[1][0];
      } else if (trimmed.startsWith(fenceMarker.repeat(3))) {
        fenceMarker = null;
      }
      continue;
    }
    if (fenceMarker !== null) {
      continue;
    }

    const match = HEADING_LINE.exec(trimmed);
    if (!match) {
      continue;
    }
    const text = normalizeHeadingText(match[1].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
    if (text && !seen.has(text)) {
      seen.add(text);
      headings.push(text);
    }
  }

  return headings;
}

export function toSearchIndexItem(post: PublishedPost, body?: string): SearchIndexItem {
  const headings = body ? extractMarkdownHeadings(body) : [];
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    summary: post.summary,
    tags: post.tags,
    ...(headings.length > 0 ? { headings } : {}),
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

  const headings = readHeadings(entry.headings, `${field}.headings`);

  return {
    slug: parsePostSlug(readString(entry.slug, `${field}.slug`), `${field}.slug`),
    title: readString(entry.title, `${field}.title`),
    date,
    summary: readString(entry.summary, `${field}.summary`),
    tags,
    ...(headings ? { headings } : {}),
  };
}

function readHeadings(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return value.map((item, index) => readString(item, `${field}[${index}]`));
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
