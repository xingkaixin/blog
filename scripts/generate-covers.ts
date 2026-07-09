#!/usr/bin/env bun
/**
 * 预生成封面多尺寸 WebP，并写入 src/lib/covers.ts（仅 URL 映射，无 imagetools 导入）
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const COVER_DIR = path.join(process.cwd(), "src", "assets", "cover");
const OUTPUT_DIR = path.join(process.cwd(), "public", "cover");
const OUTPUT_FILE = path.join(process.cwd(), "src", "lib", "covers.ts");

const SUPPORTED_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];

const VARIANTS = [
  { key: "mobile" as const, width: 400, quality: 82 },
  { key: "desktop" as const, width: 800, quality: 82 },
  { key: "full" as const, width: null as number | null, quality: 85 },
];

function filenameToVariableName(filename: string): string {
  const name = filename.replace(/\.(webp|png|jpe?g)$/i, "");
  const parts = name.split(/[-_]+/);
  const camelCase = parts
    .map((part, index) => {
      if (part.length === 0) {
        return "";
      }
      if (index === 0 && /^\d/.test(part)) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
  return `c${camelCase}`;
}

function fileStem(filename: string): string {
  return filename.replace(/\.(webp|png|jpe?g)$/i, "");
}

function needsRebuild(srcPath: string, outPath: string): boolean {
  if (!fs.existsSync(outPath)) {
    return true;
  }
  return fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs;
}

async function writeVariant(
  srcPath: string,
  outPath: string,
  width: number | null,
  quality: number,
): Promise<void> {
  let pipeline = sharp(srcPath);
  if (width !== null) {
    pipeline = pipeline.resize(width, undefined, { withoutEnlargement: true });
  }
  await pipeline.webp({ quality }).toFile(outPath);
}

async function generateCoversFile(): Promise<void> {
  if (!fs.existsSync(COVER_DIR)) {
    console.error(`❌ 封面图目录不存在: ${COVER_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs
    .readdirSync(COVER_DIR)
    .filter((file) => SUPPORTED_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext)))
    .toSorted();

  if (files.length === 0) {
    console.error(`❌ 在 ${COVER_DIR} 中没有找到图片文件`);
    process.exit(1);
  }

  console.log(`📁 找到 ${files.length} 个封面图文件`);

  const mappings: string[] = [];

  for (const file of files) {
    const srcPath = path.join(COVER_DIR, file);
    const stem = fileStem(file);
    const urls: Record<(typeof VARIANTS)[number]["key"], string> = {
      mobile: "",
      desktop: "",
      full: "",
    };

    for (const variant of VARIANTS) {
      const suffix = variant.width === null ? "" : `-${variant.width}`;
      const outName = `${stem}${suffix}.webp`;
      const outPath = path.join(OUTPUT_DIR, outName);
      const publicUrl = `/cover/${outName}`;

      if (needsRebuild(srcPath, outPath)) {
        await writeVariant(srcPath, outPath, variant.width, variant.quality);
      }

      urls[variant.key] = publicUrl;
    }

    mappings.push(
      `  "${file}": { full: "${urls.full}", desktop: "${urls.desktop}", mobile: "${urls.mobile}" }`,
    );
    console.log(`   ${file} -> ${filenameToVariableName(file)}`);
  }

  const content = `export type ResponsiveCover = {
  full: string;
  desktop: string;
  mobile: string;
};

export const covers = {
${mappings.join(",\n")},
} as const;

export function resolveCover(path: string): ResponsiveCover | null {
  const filename = path.split("/").pop();
  return filename ? (covers[filename as keyof typeof covers] ?? null) : null;
}
`;

  fs.writeFileSync(OUTPUT_FILE, content, "utf8");
  console.log(`✅ 成功生成 ${OUTPUT_FILE} 与 public/cover/ 下的 WebP`);
}

await generateCoversFile();
