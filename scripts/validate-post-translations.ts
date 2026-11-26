#!/usr/bin/env bun

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter as parseAstroFrontmatter } from "@astrojs/internal-helpers/frontmatter";
import { POST_FILE_PATTERN } from "../src/lib/post-schema";
import { parseTranslationFrontmatter } from "../src/lib/post-translation-schema";
import { parsePostSlug } from "../src/lib/published-post";
import { readPublishedPostDocuments } from "./lib/post-catalog";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const TRANSLATIONS_DIR = path.join(ROOT, "content", "posts-en");

export function computePostSourceHash(source: string): string {
  return crypto.createHash("sha256").update(source, "utf8").digest("hex").slice(0, 16);
}

export function extractMarkdownImageUrls(markdown: string): string[] {
  const urls: string[] = [];
  let fenceMarker: string | null = null;
  let fenceLength = 0;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    const fence = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fence) {
      if (fenceMarker === null) {
        fenceMarker = fence[1][0];
        fenceLength = fence[1].length;
      } else if (trimmed.startsWith(fenceMarker.repeat(fenceLength))) {
        fenceMarker = null;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceMarker !== null) {
      continue;
    }

    for (const match of line.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
      if (match[1]) {
        urls.push(match[1]);
      }
    }
    for (const match of line.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
      if (match[1]) {
        urls.push(match[1]);
      }
    }
  }

  return urls;
}

export function countFencedCodeBlocks(markdown: string): number {
  let count = 0;
  let fenceMarker: string | null = null;
  let fenceLength = 0;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    const fence = /^(`{3,}|~{3,})/.exec(trimmed);
    if (!fence) {
      continue;
    }
    if (fenceMarker === null) {
      fenceMarker = fence[1][0];
      fenceLength = fence[1].length;
      count += 1;
    } else if (
      trimmed.startsWith(fenceMarker.repeat(fenceLength)) &&
      trimmed.replace(new RegExp(`^${fenceMarker}+`), "").trim() === ""
    ) {
      fenceMarker = null;
      fenceLength = 0;
    }
  }

  return count;
}

export function hasBodyH1(markdown: string): boolean {
  let fenceMarker: string | null = null;
  let fenceLength = 0;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    const fence = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fence) {
      if (fenceMarker === null) {
        fenceMarker = fence[1][0];
        fenceLength = fence[1].length;
      } else if (
        trimmed.startsWith(fenceMarker.repeat(fenceLength)) &&
        trimmed.replace(new RegExp(`^${fenceMarker}+`), "").trim() === ""
      ) {
        fenceMarker = null;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceMarker !== null) {
      continue;
    }
    if (/^#\s+/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

function stripFencedCodeBlocks(markdown: string): string {
  const lines: string[] = [];
  let fenceMarker: string | null = null;
  let fenceLength = 0;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    const fence = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fence) {
      if (fenceMarker === null) {
        fenceMarker = fence[1][0];
        fenceLength = fence[1].length;
      } else if (
        trimmed.startsWith(fenceMarker.repeat(fenceLength)) &&
        trimmed.replace(new RegExp(`^${fenceMarker}+`), "").trim() === ""
      ) {
        fenceMarker = null;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceMarker === null) {
      lines.push(line);
    }
  }

  return lines.join("\n");
}

export function hanCharacterRatio(markdown: string): number {
  const plain = stripFencedCodeBlocks(markdown)
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\s+/g, "");
  if (plain.length === 0) {
    return 0;
  }
  const hanCount = plain.match(/\p{Script=Han}/gu)?.length ?? 0;
  return hanCount / plain.length;
}

export type TranslationValidationIssue = {
  slug: string;
  message: string;
};

export function validateSingleTranslation(
  slug: string,
  postsDir = POSTS_DIR,
  translationsDir = TRANSLATIONS_DIR,
): TranslationValidationIssue[] {
  const issues: TranslationValidationIssue[] = [];
  const sourcePath = path.join(postsDir, `${slug}.md`);
  const translationPath = path.join(translationsDir, `${slug}.md`);

  if (!fs.existsSync(sourcePath)) {
    return [{ slug, message: `source post missing: ${sourcePath}` }];
  }
  if (!fs.existsSync(translationPath)) {
    return [{ slug, message: `missing English translation: content/posts-en/${slug}.md` }];
  }

  const sourceRaw = fs.readFileSync(sourcePath, "utf8");
  const expectedHash = computePostSourceHash(sourceRaw);
  const sourceParsed = parseAstroFrontmatter(sourceRaw);

  const translationRaw = fs.readFileSync(translationPath, "utf8");
  let translationParsed: ReturnType<typeof parseAstroFrontmatter>;
  try {
    translationParsed = parseAstroFrontmatter(translationRaw);
  } catch (error) {
    return [
      {
        slug,
        message: `failed to parse frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }

  try {
    const fm = parseTranslationFrontmatter(slug, translationParsed.frontmatter);
    if (fm.sourceHash !== expectedHash) {
      issues.push({
        slug,
        message: `sourceHash mismatch (got ${fm.sourceHash}, expected ${expectedHash})`,
      });
    }
  } catch (error) {
    issues.push({
      slug,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const body = translationParsed.content.trim();
  if (body.length === 0) {
    issues.push({ slug, message: "translated body is empty" });
    return issues;
  }

  if (hasBodyH1(body)) {
    issues.push({ slug, message: "translated body must not contain an H1 heading (# )" });
  }

  const sourceImages = extractMarkdownImageUrls(sourceParsed.content);
  const translatedImages = extractMarkdownImageUrls(body);
  if (JSON.stringify(sourceImages) !== JSON.stringify(translatedImages)) {
    issues.push({
      slug,
      message: `image URLs mismatch (source: ${sourceImages.length}, translated: ${translatedImages.length})`,
    });
  }

  const sourceCodeBlocks = countFencedCodeBlocks(sourceParsed.content);
  const translatedCodeBlocks = countFencedCodeBlocks(body);
  if (sourceCodeBlocks !== translatedCodeBlocks) {
    issues.push({
      slug,
      message: `fenced code block count mismatch (source: ${sourceCodeBlocks}, translated: ${translatedCodeBlocks})`,
    });
  }

  const hanRatio = hanCharacterRatio(body);
  if (hanRatio > 0.08) {
    issues.push({
      slug,
      message: `too many untranslated Chinese characters remaining (${(hanRatio * 100).toFixed(1)}%)`,
    });
  }

  return issues;
}

export function validateAllTranslations(
  postsDir = POSTS_DIR,
  translationsDir = TRANSLATIONS_DIR,
): TranslationValidationIssue[] {
  const issues: TranslationValidationIssue[] = [];
  const publishedDocs = readPublishedPostDocuments(postsDir);
  const publishedSlugs = new Set(publishedDocs.map(({ post }) => post.slug));

  if (!fs.existsSync(translationsDir)) {
    return publishedDocs.map(({ post }) => ({
      slug: post.slug,
      message: `missing English translation: content/posts-en/${post.slug}.md`,
    }));
  }

  const entries = fs.readdirSync(translationsDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (directories.length > 0) {
    issues.push({
      slug: "<directory>",
      message: `Only flat .md files are supported under ${translationsDir}, found directories: ${directories.join(", ")}`,
    });
  }

  for (const entry of entries) {
    if (!entry.isFile() || !path.matchesGlob(entry.name, POST_FILE_PATTERN)) {
      continue;
    }
    const slug = parsePostSlug(entry.name.replace(/\.md$/, ""), "translation filename");
    if (!publishedSlugs.has(slug)) {
      const sourcePath = path.join(postsDir, `${slug}.md`);
      if (!fs.existsSync(sourcePath)) {
        issues.push({
          slug,
          message: "orphan English translation with no matching Chinese source",
        });
      }
    }
  }

  for (const { post } of publishedDocs) {
    issues.push(...validateSingleTranslation(post.slug, postsDir, translationsDir));
  }

  return issues;
}

export function listPendingSlugs(
  postsDir = POSTS_DIR,
  translationsDir = TRANSLATIONS_DIR,
): string[] {
  const publishedDocs = readPublishedPostDocuments(postsDir);
  const pending: string[] = [];

  for (const { post } of publishedDocs) {
    const issues = validateSingleTranslation(post.slug, postsDir, translationsDir);
    if (issues.length > 0) {
      pending.push(post.slug);
    }
  }

  return pending;
}

if (import.meta.main) {
  const [command = "check", ...args] = process.argv.slice(2);

  if (command === "hash") {
    const slug = args[0];
    if (!slug) {
      console.error("Usage: bun scripts/validate-post-translations.ts hash <slug>");
      process.exit(1);
    }
    const sourcePath = path.join(POSTS_DIR, `${slug}.md`);
    if (!fs.existsSync(sourcePath)) {
      console.error(`Post not found: ${sourcePath}`);
      process.exit(1);
    }
    console.log(computePostSourceHash(fs.readFileSync(sourcePath, "utf8")));
  } else if (command === "pending") {
    const pending = listPendingSlugs();
    for (const slug of pending) {
      console.log(slug);
    }
  } else if (command === "check") {
    const issues =
      args.length > 0
        ? args.flatMap((slug) => validateSingleTranslation(slug))
        : validateAllTranslations();
    if (issues.length > 0) {
      console.error(`❌ 英文翻译校验失败（${issues.length} 项问题）：`);
      for (const issue of issues) {
        console.error(`  - ${issue.slug}: ${issue.message}`);
      }
      process.exit(1);
    }
    const count = args.length > 0 ? args.length : readPublishedPostDocuments(POSTS_DIR).length;
    console.log(`✅ 英文翻译校验通过（${count} 篇）`);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}
