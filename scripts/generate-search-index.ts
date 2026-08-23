#!/usr/bin/env bun
/**
 * 生成搜索索引文件
 * 扫描 content/posts/ 目录中的所有 Markdown 文件
 * 输出为 public/search-index.json
 */

import fs from "node:fs";
import path from "node:path";
import { toSearchIndexItem } from "../src/lib/search-index";
import { readPublishedPosts } from "./lib/post-catalog";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const OUTPUT_FILE = path.join(process.cwd(), "public", "search-index.json");

export function generateSearchIndex(
  postsDirectory: string = POSTS_DIR,
  outputFile: string = OUTPUT_FILE,
): void {
  if (!fs.existsSync(postsDirectory)) {
    throw new Error(`文章目录不存在: ${postsDirectory}`);
  }

  const posts = readPublishedPosts(postsDirectory);
  const searchIndex = posts.map(toSearchIndexItem);

  if (posts.length === 0) {
    console.log(`⚠️  在 ${postsDirectory} 中没有找到已发布文章`);
  }

  fs.writeFileSync(outputFile, JSON.stringify(searchIndex, null, 2), "utf8");

  console.log(`✅ 成功生成搜索索引: ${outputFile}`);
  console.log(`   - 包含 ${searchIndex.length} 篇文章`);
}

if (import.meta.main) {
  generateSearchIndex();
}
