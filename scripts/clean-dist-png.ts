#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";

export type CleanResult = {
  removed: number;
  freedBytes: number;
};

export function cleanUnreferencedPng(imagesDirectory: string): CleanResult {
  if (!fs.existsSync(imagesDirectory)) {
    return { removed: 0, freedBytes: 0 };
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
  const imagesDirectory = path.join(process.cwd(), "dist", "posts", "images");
  const result = cleanUnreferencedPng(imagesDirectory);
  console.log("✅ 清理 dist 中未引用的 PNG");
  console.log(`   - 删除 ${result.removed} 个文件`);
  console.log(`   - 释放 ${(result.freedBytes / 1024 / 1024).toFixed(1)}MB`);
}
