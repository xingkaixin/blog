#!/usr/bin/env bun
/**
 * 生成搜索索引文件
 * 扫描 content/posts/ 目录中的所有 Markdown 文件
 * 输出为 public/search-index.json
 */

import fs from "node:fs";
import path from "node:path";
import { readPublishedPosts } from "./lib/post-catalog";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const OUTPUT_FILE = path.join(process.cwd(), "public", "search-index.json");

function generateSearchIndex(): void {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`❌ 文章目录不存在: ${POSTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith(".md"));

  if (files.length === 0) {
    console.log(`⚠️  在 ${POSTS_DIR} 中没有找到文章`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2), "utf8");
    console.log(`✅ 生成空的搜索索引: ${OUTPUT_FILE}`);
    return;
  }

  console.log(`📁 找到 ${files.length} 篇文章`);

  const searchIndex = readPublishedPosts(POSTS_DIR);

  // 写入 JSON 文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(searchIndex, null, 2), "utf8");

  console.log(`✅ 成功生成搜索索引: ${OUTPUT_FILE}`);
  console.log(`   - 包含 ${searchIndex.length} 篇文章`);
}

// 执行生成
generateSearchIndex();
