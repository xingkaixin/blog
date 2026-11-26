#!/usr/bin/env bun
/**
 * 生成搜索索引文件
 * 扫描 content/posts/ 目录中的所有 Markdown 文件
 * 输出为 public/search-index.json
 */

import fs from "node:fs";
import path from "node:path";
import { toSearchIndexItem } from "../src/lib/search-index";
import { readEnglishPublishedPostDocuments, readPublishedPostDocuments } from "./lib/post-catalog";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const TRANSLATIONS_DIR = path.join(process.cwd(), "content", "posts-en");
const OUTPUT_FILE = path.join(process.cwd(), "public", "search-index.json");
const EN_OUTPUT_FILE = path.join(process.cwd(), "public", "search-index-en.json");

export function generateSearchIndex(
  postsDirectory: string = POSTS_DIR,
  outputFile: string = OUTPUT_FILE,
): void {
  if (!fs.existsSync(postsDirectory)) {
    throw new Error(`文章目录不存在: ${postsDirectory}`);
  }

  const documents = readPublishedPostDocuments(postsDirectory);
  const searchIndex = documents.map(({ post, body }) => toSearchIndexItem(post, body));

  if (documents.length === 0) {
    console.log(`⚠️  在 ${postsDirectory} 中没有找到已发布文章`);
  }

  fs.writeFileSync(outputFile, JSON.stringify(searchIndex), "utf8");

  console.log(`✅ 成功生成搜索索引: ${outputFile}`);
  console.log(`   - 包含 ${searchIndex.length} 篇文章`);
}

export function generateEnglishSearchIndex(
  postsDirectory: string = POSTS_DIR,
  translationsDirectory: string = TRANSLATIONS_DIR,
  outputFile: string = EN_OUTPUT_FILE,
): void {
  const documents = readEnglishPublishedPostDocuments(postsDirectory, translationsDirectory);
  const searchIndex = documents.map(({ post, body }) => toSearchIndexItem(post, body));

  fs.writeFileSync(outputFile, JSON.stringify(searchIndex), "utf8");

  console.log(`✅ 成功生成英文搜索索引: ${outputFile}`);
  console.log(`   - 包含 ${searchIndex.length} 篇文章`);
}

if (import.meta.main) {
  generateSearchIndex();
  generateEnglishSearchIndex();
}
