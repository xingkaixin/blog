import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";
import { isPublishedFrontmatter, parseFrontmatter } from "../../src/lib/post-schema";
import {
  comparePublishedPostsNewestFirst,
  toPublishedPost,
  type PublishedPost,
} from "../../src/lib/published-post";

const MAX_FRONTMATTER_CHARACTERS = 64 * 1024;
const MAX_YAML_ALIAS_COUNT = 50;

export function parsePublishedPost(slug: string, source: string): PublishedPost | null {
  const frontmatter = parseFrontmatter(slug, parsePostFrontmatter(source));

  if (!isPublishedFrontmatter(frontmatter)) {
    return null;
  }

  return toPublishedPost(slug, frontmatter);
}

function parsePostFrontmatter(source: string): unknown {
  const normalized = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const openingLineEnd = normalized.indexOf("\n");
  const openingLine = normalized.slice(0, openingLineEnd).replace(/\r$/, "");
  if (openingLineEnd < 0 || openingLine !== "---") {
    throw new Error("Post must start with a YAML frontmatter delimiter");
  }

  const contentStart = openingLineEnd + 1;
  const searchWindow = normalized.slice(
    contentStart,
    contentStart + MAX_FRONTMATTER_CHARACTERS + 6,
  );
  const closingDelimiter = /^---[\t ]*\r?$/m.exec(searchWindow);
  if (closingDelimiter?.index === undefined) {
    throw new Error(`Post frontmatter is missing a closing delimiter or exceeds 65,536 characters`);
  }

  const document = parseDocument(searchWindow.slice(0, closingDelimiter.index), {
    schema: "core",
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(`Invalid post frontmatter: ${document.errors[0].message}`);
  }
  return document.toJS({ maxAliasCount: MAX_YAML_ALIAS_COUNT });
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
    .toSorted(comparePublishedPostsNewestFirst);
}

export type { PublishedPost } from "../../src/lib/published-post";
