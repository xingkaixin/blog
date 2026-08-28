import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter as parseAstroFrontmatter } from "@astrojs/internal-helpers/frontmatter";
import {
  createPostFrontmatterSchema,
  isPublishedFrontmatter,
  parseFrontmatter,
  POST_FILE_PATTERN,
} from "../../src/lib/post-schema";
import {
  comparePublishedPostsNewestFirst,
  parsePostSlug,
  toPublishedPost,
  type PublishedPost,
} from "../../src/lib/published-post";

const postFrontmatterSchema = createPostFrontmatterSchema(
  fileURLToPath(new URL("../../src/assets/cover/", import.meta.url)),
);

export function parsePublishedPost(slug: string, source: string): PublishedPost | null {
  const postSlug = parsePostSlug(slug, "post slug");
  const frontmatter = parseFrontmatter(
    postFrontmatterSchema,
    postSlug,
    parseAstroFrontmatter(source).frontmatter,
  );

  if (!isPublishedFrontmatter(frontmatter)) {
    return null;
  }

  return toPublishedPost(postSlug, frontmatter);
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
    .filter((file) => path.matchesGlob(file, POST_FILE_PATTERN))
    .map((file) =>
      parsePublishedPost(
        file.replace(/\.md$/, ""),
        fs.readFileSync(path.join(postsDirectory, file), "utf8"),
      ),
    )
    .filter((post): post is PublishedPost => post !== null)
    .toSorted(comparePublishedPostsNewestFirst);
}
