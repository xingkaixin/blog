import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { postFrontmatterSchema, toDateValue, type PublishedPost } from "../../src/lib/post-schema";

function frontmatterError(slug: string, issues: Array<{ path: PropertyKey[]; message: string }>) {
  const details = issues
    .map(({ path: issuePath, message }) => `${issuePath.join(".") || "frontmatter"}: ${message}`)
    .join("; ");
  return new Error(`Invalid frontmatter for ${slug}: ${details}`);
}

export function parsePublishedPost(slug: string, source: string): PublishedPost | null {
  const { data } = matter(source);
  const result = postFrontmatterSchema.safeParse(data);
  if (!result.success) {
    throw frontmatterError(slug, result.error.issues);
  }

  if (result.data.draft) {
    return null;
  }

  return {
    slug,
    title: result.data.title,
    date: toDateValue(result.data.date),
    summary: result.data.summary,
    tags: result.data.tags,
    cover: result.data.cover,
    coverAlt: result.data.coverAlt,
  };
}

export function readPublishedPosts(postsDirectory: string): PublishedPost[] {
  return fs
    .readdirSync(postsDirectory)
    .filter((file) => file.endsWith(".md"))
    .map((file) =>
      parsePublishedPost(
        file.replace(/\.md$/, ""),
        fs.readFileSync(path.join(postsDirectory, file), "utf8"),
      ),
    )
    .filter((post): post is PublishedPost => post !== null)
    .toSorted((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export type { PublishedPost } from "../../src/lib/post-schema";
