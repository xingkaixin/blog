import { z } from "astro/zod";

export const SOURCE_HASH_PATTERN = /^[a-f0-9]{16}$/;

export const postTranslationFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    coverAlt: z.string().trim().min(1),
    sourceHash: z
      .string()
      .trim()
      .regex(SOURCE_HASH_PATTERN, "sourceHash must be a 16-character lowercase hex sha256 prefix"),
  })
  .strict();

export type PostTranslationFrontmatter = z.infer<typeof postTranslationFrontmatterSchema>;

type FrontmatterIssue = {
  path: PropertyKey[];
  message: string;
};

export function translationFrontmatterError(slug: string, issues: FrontmatterIssue[]) {
  const details = issues
    .map(({ path: issuePath, message }) => `${issuePath.join(".") || "frontmatter"}: ${message}`)
    .join("; ");
  return new Error(`Invalid English translation frontmatter for ${slug}: ${details}`);
}

export function parseTranslationFrontmatter(
  slug: string,
  data: unknown,
): PostTranslationFrontmatter {
  const result = postTranslationFrontmatterSchema.safeParse(data);
  if (!result.success) {
    throw translationFrontmatterError(slug, result.error.issues);
  }
  return result.data;
}
