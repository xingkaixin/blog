#!/usr/bin/env bun
/**
 * 清理 dist 中的未引用源 PNG。
 *
 * 文章插图经 generate-post-images.ts 转为 webp 后，
 * 页面只引用 webp（见 rehype-blog-content.ts），源 PNG 仅作映射查找键，
 * 因此 dist/posts/images 下的 PNG 全部未被引用，删除以减小部署体积。
 */

import fs from "node:fs";
import path from "node:path";

const DIST_IMAGES = path.join(process.cwd(), "dist", "posts", "images");

if (!fs.existsSync(DIST_IMAGES)) {
  console.log("📁 dist/posts/images 不存在，跳过");
  process.exit(0);
}

let removed = 0;
let freedBytes = 0;

for (const dir of fs.readdirSync(DIST_IMAGES, { withFileTypes: true })) {
  if (!dir.isDirectory()) {
    continue;
  }
  const articleDir = path.join(DIST_IMAGES, dir.name);
  for (const file of fs.readdirSync(articleDir)) {
    if (!file.toLowerCase().endsWith(".png")) {
      continue;
    }
    const filePath = path.join(articleDir, file);
    freedBytes += fs.statSync(filePath).size;
    fs.rmSync(filePath);
    removed++;
  }
}

console.log(`✅ 清理 dist 中未引用的 PNG`);
console.log(`   - 删除 ${removed} 个文件`);
console.log(`   - 释放 ${(freedBytes / 1024 / 1024).toFixed(1)}MB`);
