#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";

export type CleanResult = {
  removed: number;
  freedBytes: number;
};

const SOURCE_PNG_REFERENCE = /\/posts\/images\/[^"'\s)]+\.png/gi;

function findSourcePngReferences(distDirectory: string): string[] {
  const referenced = new Set<string>();

  for (const relativePath of fs.readdirSync(distDirectory, { recursive: true }) as string[]) {
    if (!relativePath.endsWith(".html")) {
      continue;
    }
    const html = fs.readFileSync(path.join(distDirectory, relativePath), "utf8");
    for (const [reference] of html.matchAll(SOURCE_PNG_REFERENCE)) {
      referenced.add(reference);
    }
  }

  return [...referenced].toSorted();
}

// 文章插图统一由 generate-post-images 转成 WebP，rehype-blog-content 再把 <img> 换成只引用
// WebP 的 <picture>，所以产物 HTML 不该残留任何源 PNG 引用。删除前先断言这条约定：
// 一旦某张图没走通管线，构建就在这里失败，而不是把线上还在引用的图片删成 404。
export function removeSourcePng(distDirectory: string): CleanResult {
  const imagesDirectory = path.join(distDirectory, "posts", "images");
  if (!fs.existsSync(imagesDirectory)) {
    return { removed: 0, freedBytes: 0 };
  }

  const referenced = findSourcePngReferences(distDirectory);
  if (referenced.length > 0) {
    throw new Error(
      `Built HTML still references source PNG files, so generate-post-images did not cover them: ${referenced.join(", ")}`,
    );
  }

  let removed = 0;
  let freedBytes = 0;
  for (const directory of fs.readdirSync(imagesDirectory, { withFileTypes: true })) {
    if (!directory.isDirectory()) {
      continue;
    }
    const articleDirectory = path.join(imagesDirectory, directory.name);
    for (const file of fs.readdirSync(articleDirectory)) {
      if (!file.toLowerCase().endsWith(".png")) {
        continue;
      }
      const filePath = path.join(articleDirectory, file);
      freedBytes += fs.statSync(filePath).size;
      fs.rmSync(filePath);
      removed += 1;
    }
  }
  return { removed, freedBytes };
}

if (import.meta.main) {
  const result = removeSourcePng(path.join(process.cwd(), "dist"));
  console.log("✅ 清理 dist 中已被 WebP 取代的源 PNG");
  console.log(`   - 删除 ${result.removed} 个文件`);
  console.log(`   - 释放 ${(result.freedBytes / 1024 / 1024).toFixed(1)}MB`);
}
