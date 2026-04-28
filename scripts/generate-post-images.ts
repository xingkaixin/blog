#!/usr/bin/env bun
/**
 * 文章插图优化脚本
 * 扫描 public/posts/images/ 目录，为每张图片生成多尺寸 WebP 版本
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const IMAGES_DIR = path.join(process.cwd(), "public", "posts", "images");
const OUTPUT_FILE = path.join(process.cwd(), "src", "lib", "post-images.ts");

const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg"];

// 需要生成的尺寸配置
const SIZE_VARIANTS = [
  { suffix: "800w", width: 800, quality: 80 },
  { suffix: "1200w", width: 1200, quality: 80 },
];

interface ImageMapping {
  src: string;
  webp: string;
  mobile: string;
  desktop: string;
}

function getRelativePath(absolutePath: string): string {
  return "/" + path.relative(path.join(process.cwd(), "public"), absolutePath).replace(/\\/g, "/");
}

function needsRebuild(srcPath: string, outputPath: string): boolean {
  if (!fs.existsSync(outputPath)) {
    return true;
  }
  const srcStat = fs.statSync(srcPath);
  const outStat = fs.statSync(outputPath);
  return srcStat.mtimeMs > outStat.mtimeMs;
}

async function processImage(srcPath: string): Promise<ImageMapping | null> {
  const dir = path.dirname(srcPath);
  const basename = path.basename(srcPath, path.extname(srcPath));
  const webpPath = path.join(dir, `${basename}.webp`);

  const mapping: ImageMapping = {
    src: getRelativePath(srcPath),
    webp: getRelativePath(webpPath),
    mobile: "",
    desktop: "",
  };

  // 生成原尺寸 WebP (quality 85)
  if (needsRebuild(srcPath, webpPath)) {
    await sharp(srcPath).webp({ quality: 85 }).toFile(webpPath);
  }

  // 生成各尺寸版本
  for (const variant of SIZE_VARIANTS) {
    const outputPath = path.join(dir, `${basename}-${variant.suffix}.webp`);

    if (variant.suffix === "800w") {
      mapping.mobile = getRelativePath(outputPath);
    } else if (variant.suffix === "1200w") {
      mapping.desktop = getRelativePath(outputPath);
    }

    if (needsRebuild(srcPath, outputPath)) {
      await sharp(srcPath)
        .resize(variant.width, null, { withoutEnlargement: true })
        .webp({ quality: variant.quality })
        .toFile(outputPath);
    }
  }

  return mapping;
}

async function generatePostImages(): Promise<void> {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log("📁 文章插图目录不存在，跳过");
    return;
  }

  const entries = fs.readdirSync(IMAGES_DIR, { withFileTypes: true });
  const mappings: ImageMapping[] = [];
  let processed = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const articleDir = path.join(IMAGES_DIR, entry.name);
    const files = fs.readdirSync(articleDir).filter((file) =>
      SUPPORTED_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext)),
    );

    for (const file of files) {
      const srcPath = path.join(articleDir, file);
      const result = await processImage(srcPath);
      if (result) {
        mappings.push(result);
        processed++;
      }
    }
  }

  // 按路径排序，保证输出稳定
  mappings.sort((a, b) => a.src.localeCompare(b.src));

  // 生成映射文件
  const lines = mappings.map(
    (m) =>
      `  "${m.src}": { src: "${m.src}", webp: "${m.webp}", mobile: "${m.mobile}", desktop: "${m.desktop}" }`,
  );

  const content = `export type ResponsivePostImage = {
  src: string;
  webp: string;
  mobile: string;
  desktop: string;
};

export const postImages: Record<string, ResponsivePostImage> = {
${lines.join(",\n")},
};
`;

  fs.writeFileSync(OUTPUT_FILE, content, "utf8");

  console.log(`✅ 文章插图优化完成`);
  console.log(`   - 处理 ${processed} 张图片`);
  console.log(`   - 映射文件: ${OUTPUT_FILE}`);
}

generatePostImages().catch((error) => {
  console.error("❌ 生成失败:", error);
  process.exit(1);
});
