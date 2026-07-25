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

// 文章发现的唯一实现：平铺一层。content collection 的 glob 与之对齐，
// 子目录在这里显式失败，而不是让文章在 sitemap/feed/搜索索引里悄悄缺席。
export function readPublishedPosts(postsDirectory: string): PublishedPost[] {
  const entries = fs.readdirSync(postsDirectory, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (directories.length > 0) {
    throw new Error(
      `Only flat .md files are supported under ${postsDirectory}, found directories: ${directories.join(", ")}`,
    );
  }

  return entries
    .map((entry) => entry.name)
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
