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
import { parseTranslationFrontmatter } from "../../src/lib/post-translation-schema";
import {
  comparePublishedPostsNewestFirst,
  parsePostSlug,
  toPublishedPost,
  type PublishedPost,
} from "../../src/lib/published-post";

const postFrontmatterSchema = createPostFrontmatterSchema(
  fileURLToPath(new URL("../../src/assets/cover/", import.meta.url)),
);

export type PublishedPostDocument = {
  post: PublishedPost;
  body: string;
};

export function parsePublishedPostDocument(
  slug: string,
  source: string,
): PublishedPostDocument | null {
  const postSlug = parsePostSlug(slug, "post slug");
  const parsed = parseAstroFrontmatter(source);
  const frontmatter = parseFrontmatter(postFrontmatterSchema, postSlug, parsed.frontmatter);

  if (!isPublishedFrontmatter(frontmatter)) {
    return null;
  }

  return {
    post: toPublishedPost(postSlug, frontmatter),
    body: parsed.content,
  };
}

export function parsePublishedPost(slug: string, source: string): PublishedPost | null {
  return parsePublishedPostDocument(slug, source)?.post ?? null;
}

// 文章发现的唯一实现：平铺一层。content collection 的 glob 与之对齐，
// 子目录在这里显式失败，而不是让文章在 sitemap/feed/搜索索引里悄悄缺席。
export function readPublishedPostDocuments(postsDirectory: string): PublishedPostDocument[] {
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
      parsePublishedPostDocument(
        file.replace(/\.md$/, ""),
        fs.readFileSync(path.join(postsDirectory, file), "utf8"),
      ),
    )
    .filter((doc): doc is PublishedPostDocument => doc !== null)
    .toSorted((left, right) => comparePublishedPostsNewestFirst(left.post, right.post));
}

export function readPublishedPosts(postsDirectory: string): PublishedPost[] {
  return readPublishedPostDocuments(postsDirectory).map(({ post }) => post);
}

export function readEnglishPublishedPostDocuments(
  postsDirectory: string,
  translationsDirectory: string,
): PublishedPostDocument[] {
  const sourceDocs = readPublishedPostDocuments(postsDirectory);
  if (!fs.existsSync(translationsDirectory)) {
    throw new Error(`English translations directory not found: ${translationsDirectory}`);
  }
  const entries = fs.readdirSync(translationsDirectory, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (directories.length > 0) {
    throw new Error(
      `Only flat .md files are supported under ${translationsDirectory}, found directories: ${directories.join(", ")}`,
    );
  }

  return sourceDocs.map(({ post }) => {
    const filePath = path.join(translationsDirectory, `${post.slug}.md`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing English translation for published post "${post.slug}"`);
    }
    const parsed = parseAstroFrontmatter(fs.readFileSync(filePath, "utf8"));
    const translation = parseTranslationFrontmatter(post.slug, parsed.frontmatter);
    return {
      post: {
        ...post,
        title: translation.title,
        summary: translation.summary,
        coverAlt: translation.coverAlt,
      },
      body: parsed.content,
    };
  });
}
