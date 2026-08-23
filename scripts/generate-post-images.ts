#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import {
  collectResponsiveImageFiles,
  generateResponsiveImages,
  type ResponsiveImageVariant,
} from "./lib/responsive-image-generator";

type PostImageVariantKey = "webp" | "mobile" | "desktop";

const VARIANTS: Array<ResponsiveImageVariant<PostImageVariantKey>> = [
  { key: "webp", suffix: "", width: null, quality: 85 },
  { key: "mobile", suffix: "-800w", width: 800, quality: 80 },
  { key: "desktop", suffix: "-1200w", width: 1200, quality: 80 },
];

export type GeneratePostImagesOptions = {
  sourceDirectory: string;
  outputDirectory: string;
  dataFile: string;
  manifestFile: string;
};

export type GeneratePostImagesResult = {
  generated: number;
  reused: number;
  removed: number;
};

type ImageMapping = {
  src: string;
  webp: string;
  mobile: string;
  desktop: string;
};

export async function generatePostImages(
  options: GeneratePostImagesOptions = defaultOptions(),
): Promise<GeneratePostImagesResult> {
  if (!fs.existsSync(options.sourceDirectory)) {
    throw new Error(`文章插图源目录不存在: ${options.sourceDirectory}`);
  }
  const sources = collectResponsiveImageFiles(options.sourceDirectory, true);
  if (sources.length === 0) {
    throw new Error(`文章插图源目录中没有图片: ${options.sourceDirectory}`);
  }

  const mappings: Record<string, ImageMapping> = {};
  const result = await generateResponsiveImages({
    assetName: "文章插图",
    outputDirectory: options.outputDirectory,
    manifestFile: options.manifestFile,
    variants: VARIANTS,
    recursive: true,
    sources: sources.map((source) => {
      const relativeSource = normalizePath(path.relative(options.sourceDirectory, source));
      return {
        key: `/posts/images/${relativeSource}`,
        file: source,
        stem: relativeSource.slice(0, -path.extname(relativeSource).length),
      };
    }),
  });
  for (const image of result.images) {
    mappings[image.key] = {
      src: image.key,
      webp: publicUrl(options.outputDirectory, image.outputs.webp),
      mobile: publicUrl(options.outputDirectory, image.outputs.mobile),
      desktop: publicUrl(options.outputDirectory, image.outputs.desktop),
    };
  }
  writeDataFile(options.dataFile, mappings);
  return { generated: result.generated, reused: result.reused, removed: result.removed };
}

function publicUrl(outputDirectory: string, output: string): string {
  return `/posts/images/${normalizePath(path.relative(outputDirectory, output))}`;
}

function writeDataFile(file: string, mappings: Record<string, ImageMapping>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(mappings, null, 2)}\n`, "utf8");
}

function normalizePath(value: string): string {
  return value.replaceAll(path.sep, "/");
}

function defaultOptions(): GeneratePostImagesOptions {
  const root = process.cwd();
  return {
    sourceDirectory: path.join(root, "src", "assets", "post-images"),
    outputDirectory: path.join(root, "public", "posts", "images"),
    dataFile: path.join(root, "src", "lib", "generated", "post-images.json"),
    manifestFile: path.join(root, "src", "lib", "generated", "post-images-manifest.json"),
  };
}

if (import.meta.main) {
  const result = await generatePostImages();
  console.log(
    `✅ 文章插图：生成 ${result.generated}，复用 ${result.reused}，清理 ${result.removed}`,
  );
}
