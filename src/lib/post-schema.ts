import fs from "node:fs";
import path from "node:path";
import { z } from "astro/zod";
import { canonicalTag } from "./post-tag";
import { isCalendarDate } from "./published-post";

const COVER_DIR = path.join(process.cwd(), "src", "assets", "cover");
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COVER_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i;
const COVER_MISSING_MESSAGE = "Cover image not found";

export const calendarDateSchema = z
  .string()
  .regex(CALENDAR_DATE_PATTERN, "date must use YYYY-MM-DD")
  .refine(isCalendarDate, "date must be a valid calendar date");

const tagsSchema = z
  .array(z.string().transform(canonicalTag).pipe(z.string().min(1)))
  .min(1)
  .refine((tags) => new Set(tags).size === tags.length, "tags must be unique within a post");

export const postFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1),
    date: calendarDateSchema,
    summary: z.string().trim().min(1),
    tags: tagsSchema,
    cover: z.string().trim().regex(COVER_FILENAME_PATTERN, "cover must be an image filename"),
    coverAlt: z.string().trim().min(1),
    draft: z.boolean().optional(),
  })
  .refine(({ cover }) => coverExists(cover), {
    message: COVER_MISSING_MESSAGE,
    path: ["cover"],
  });

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

function coverExists(cover: string) {
  return fs.existsSync(path.join(COVER_DIR, cover));
}

type FrontmatterIssue = {
  path: PropertyKey[];
  message: string;
};

export function frontmatterError(slug: string, issues: FrontmatterIssue[]) {
  const details = issues
    .map(({ path: issuePath, message }) => `${issuePath.join(".") || "frontmatter"}: ${message}`)
    .join("; ");
  return new Error(`Invalid frontmatter for ${slug}: ${details}`);
}

export function parseFrontmatter(slug: string, data: unknown): PostFrontmatter {
  const result = postFrontmatterSchema.safeParse(data);
  if (!result.success) {
    throw frontmatterError(slug, result.error.issues);
  }

  return result.data;
}

export function isPublishedFrontmatter(frontmatter: PostFrontmatter): boolean {
  return frontmatter.draft !== true;
}
