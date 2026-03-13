#!/usr/bin/env bun
/**
 * 生成搜索索引文件
 * 扫描 content/posts/ 目录中的所有 Markdown 文件
 * 输出为 public/search-index.json
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const OUTPUT_FILE = path.join(process.cwd(), "public", "search-index.json");

interface SearchIndexItem {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string;
  coverAlt: string;
}

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

  const searchIndex: SearchIndexItem[] = [];

  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const source = fs.readFileSync(filePath, "utf8");
    const { data } = matter(source);

    // 跳过草稿
    if (data.draft) {
      continue;
    }

    const slug = file.replace(/\.md$/, "");

    searchIndex.push({
      slug,
      title: String(data.title ?? ""),
      date: String(data.date ?? ""),
      summary: String(data.summary ?? ""),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      cover: String(data.cover ?? ""),
      coverAlt: String(data.coverAlt ?? ""),
    });
  }

  // 按日期排序，最新的在前
  searchIndex.sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  // 写入 JSON 文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(searchIndex, null, 2), "utf8");

  console.log(`✅ 成功生成搜索索引: ${OUTPUT_FILE}`);
  console.log(`   - 包含 ${searchIndex.length} 篇文章`);
}

// 执行生成
generateSearchIndex();
