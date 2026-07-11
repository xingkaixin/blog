import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type PublishedPost = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string;
  coverAlt: string;
};

function frontmatterString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function parsePublishedPost(slug: string, source: string): PublishedPost | null {
  const { data } = matter(source);
  if (data.draft) {
    return null;
  }
  return {
    slug,
    title: frontmatterString(data.title),
    date: frontmatterString(data.date),
    summary: frontmatterString(data.summary),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    cover: frontmatterString(data.cover),
    coverAlt: frontmatterString(data.coverAlt),
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
