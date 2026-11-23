#!/usr/bin/env bun

import path from "node:path";
import {
  defaultResponsiveImageSetOptions,
  generateResponsiveImageSet,
  type ResponsiveImageSetOptions,
  type ResponsiveImageVariant,
} from "./lib/responsive-image-generator";

type CoverVariantKey = "mobile" | "desktop" | "full";
type CoverAvifVariantKey = "mobileAvif" | "desktopAvif" | "fullAvif";

const VARIANTS: Array<ResponsiveImageVariant<CoverVariantKey>> = [
  { key: "mobile", suffix: "-400", width: 400, quality: 82 },
  { key: "desktop", suffix: "-800", width: 800, quality: 82 },
  { key: "full", suffix: "", width: null, quality: 85 },
];

const AVIF_VARIANTS: Array<ResponsiveImageVariant<CoverAvifVariantKey>> = [
  { key: "mobileAvif", suffix: "-400", width: 400, quality: 55 },
  { key: "desktopAvif", suffix: "-800", width: 800, quality: 55 },
  { key: "fullAvif", suffix: "", width: null, quality: 55 },
];

export type GenerateCoversOptions = ResponsiveImageSetOptions;

export function generateCovers(
  options: GenerateCoversOptions = defaultResponsiveImageSetOptions({
    source: "cover",
    output: "cover",
    data: "covers",
  }),
) {
  return generateResponsiveImageSet(options, {
    assetName: "封面",
    variants: VARIANTS,
    avifVariants: AVIF_VARIANTS,
    metadataVariant: "full",
    recursive: false,
    source: (file) => {
      const filename = path.basename(file);
      return { key: filename, file, stem: filename.slice(0, -path.extname(filename).length) };
    },
    url: (output) => `/cover/${path.basename(output)}`,
  });
}

if (import.meta.main) {
  const result = await generateCovers();
  console.log(`✅ 封面：生成 ${result.generated}，复用 ${result.reused}，清理 ${result.removed}`);
}
