#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import {
  collectResponsiveImageFiles,
  generateResponsiveImages,
  type ResponsiveImageVariant,
} from "./lib/responsive-image-generator";

type CoverVariantKey = "mobile" | "desktop" | "full";

const VARIANTS: Array<ResponsiveImageVariant<CoverVariantKey>> = [
  { key: "mobile", suffix: "-400", width: 400, quality: 82 },
  { key: "desktop", suffix: "-800", width: 800, quality: 82 },
  { key: "full", suffix: "", width: null, quality: 85 },
];

export type GenerateCoversOptions = {
  sourceDirectory: string;
  outputDirectory: string;
  dataFile: string;
  manifestFile: string;
};

export type GenerateCoversResult = {
  generated: number;
  reused: number;
  removed: number;
};

type CoverMapping = {
  full: string;
  desktop: string;
  mobile: string;
};

export async function generateCovers(
  options: GenerateCoversOptions = defaultOptions(),
): Promise<GenerateCoversResult> {
  if (!fs.existsSync(options.sourceDirectory)) {
    throw new Error(`封面源目录不存在: ${options.sourceDirectory}`);
  }
  const sources = collectResponsiveImageFiles(options.sourceDirectory, false);
  if (sources.length === 0) {
    throw new Error(`封面源目录中没有图片: ${options.sourceDirectory}`);
  }

  const mappings: Record<string, CoverMapping> = {};
  const result = await generateResponsiveImages({
    assetName: "封面",
    outputDirectory: options.outputDirectory,
    manifestFile: options.manifestFile,
    variants: VARIANTS,
    sources: sources.map((source) => {
      const filename = path.basename(source);
      return {
        key: filename,
        file: source,
        stem: filename.slice(0, -path.extname(filename).length),
      };
    }),
  });
  for (const image of result.images) {
    const filename = image.key;
    mappings[filename] = {
      mobile: `/cover/${path.basename(image.outputs.mobile)}`,
      desktop: `/cover/${path.basename(image.outputs.desktop)}`,
      full: `/cover/${path.basename(image.outputs.full)}`,
    };
  }
  writeDataFile(options.dataFile, mappings);
  return { generated: result.generated, reused: result.reused, removed: result.removed };
}

function writeDataFile(file: string, mappings: Record<string, CoverMapping>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(mappings, null, 2)}\n`, "utf8");
}

function defaultOptions(): GenerateCoversOptions {
  const root = process.cwd();
  return {
    sourceDirectory: path.join(root, "src", "assets", "cover"),
    outputDirectory: path.join(root, "public", "cover"),
    dataFile: path.join(root, "src", "lib", "generated", "covers.json"),
    manifestFile: path.join(root, "src", "lib", "generated", "covers-manifest.json"),
  };
}

if (import.meta.main) {
  const result = await generateCovers();
  console.log(`✅ 封面：生成 ${result.generated}，复用 ${result.reused}，清理 ${result.removed}`);
}
