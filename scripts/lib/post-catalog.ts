import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parseFrontmatter, toDateValue, type PublishedPost } from "../../src/lib/post-schema";

export function parsePublishedPost(slug: string, source: string): PublishedPost | null {
  const frontmatter = parseFrontmatter(slug, matter(source).data);

  if (frontmatter.draft) {
    return null;
  }

  return {
    slug,
    title: frontmatter.title,
    date: toDateValue(frontmatter.date),
    summary: frontmatter.summary,
    tags: frontmatter.tags,
    cover: frontmatter.cover,
    coverAlt: frontmatter.coverAlt,
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
