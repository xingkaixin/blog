import fs from "node:fs";
import path from "node:path";
import { z } from "astro/zod";
import { isCalendarDate } from "./published-post";

const COVER_DIR = path.join(process.cwd(), "src", "assets", "cover");
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const calendarDateSchema = z
  .string()
  .regex(CALENDAR_DATE_PATTERN, "date must use YYYY-MM-DD")
  .refine(isCalendarDate, "date must be a valid calendar date");

const tagsSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .refine((tags) => new Set(tags).size === tags.length, "tags must be unique within a post");

export const postFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  date: calendarDateSchema,
  summary: z.string().trim().min(1),
  tags: tagsSchema,
  cover: z.string().min(1),
  coverAlt: z.string().trim().min(1),
  draft: z.boolean().optional(),
});

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

export const COVER_MISSING_MESSAGE = "Cover image not found";

export function coverExists(cover: string) {
  return fs.existsSync(path.join(COVER_DIR, path.basename(cover)));
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

// 校验规则的唯一入口：schema 之外只多一条"封面文件必须存在"。
// content collection、构建脚本与 vite 插件都经由此处，规则改一次即可全线生效。
export function parseFrontmatter(slug: string, data: unknown): PostFrontmatter {
  const result = postFrontmatterSchema.safeParse(data);
  if (!result.success) {
    throw frontmatterError(slug, result.error.issues);
  }

  if (!coverExists(result.data.cover)) {
    throw frontmatterError(slug, [{ path: ["cover"], message: COVER_MISSING_MESSAGE }]);
  }

  return result.data;
}

export function isPublishedFrontmatter(frontmatter: PostFrontmatter): boolean {
  return frontmatter.draft !== true;
}

export type { PublishedPost } from "./published-post";
