#!/usr/bin/env bun

import path from "node:path";
import {
  defaultResponsiveImageSetOptions,
  generateResponsiveImageSet,
  type ResponsiveImageSetOptions,
  type ResponsiveImageVariant,
} from "./lib/responsive-image-generator";

type PostImageVariantKey = "webp" | "mobile" | "desktop";
type PostImageAvifVariantKey = "avif" | "mobileAvif" | "desktopAvif";

const VARIANTS: Array<ResponsiveImageVariant<PostImageVariantKey>> = [
  { key: "webp", suffix: "", width: null, quality: 85 },
  { key: "mobile", suffix: "-800w", width: 800, quality: 80 },
  { key: "desktop", suffix: "-1200w", width: 1200, quality: 80 },
];

const AVIF_VARIANTS: Array<ResponsiveImageVariant<PostImageAvifVariantKey>> = [
  { key: "avif", suffix: "", width: null, quality: 55 },
  { key: "mobileAvif", suffix: "-800w", width: 800, quality: 55 },
  { key: "desktopAvif", suffix: "-1200w", width: 1200, quality: 55 },
];

export type GeneratePostImagesOptions = ResponsiveImageSetOptions;

export function generatePostImages(
  options: GeneratePostImagesOptions = defaultResponsiveImageSetOptions({
    source: "post-images",
    output: path.join("posts", "images"),
    data: "post-images",
  }),
) {
  return generateResponsiveImageSet(options, {
    assetName: "文章插图",
    variants: VARIANTS,
    avifVariants: AVIF_VARIANTS,
    metadataVariant: "webp",
    recursive: true,
    source: (file) => {
      const relativeSource = normalizePath(path.relative(options.sourceDirectory, file));
      return {
        key: `/posts/images/${relativeSource}`,
        file,
        stem: relativeSource.slice(0, -path.extname(relativeSource).length),
      };
    },
    url: (output) =>
      `/posts/images/${normalizePath(path.relative(options.outputDirectory, output))}`,
  });
}

function normalizePath(value: string): string {
  return value.replaceAll(path.sep, "/");
}

if (import.meta.main) {
  const result = await generatePostImages();
  console.log(
    `✅ 文章插图：生成 ${result.generated}，复用 ${result.reused}，清理 ${result.removed}`,
  );
}
