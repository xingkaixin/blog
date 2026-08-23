#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint, reconcileArtifacts, type ArtifactPlan } from "./lib/artifact-reconciler";
import { bunImageRendererFingerprintParts, writeWebpVariants } from "./lib/bun-image";

const SUPPORTED_SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VARIANTS = [
  { key: "webp" as const, suffix: "", width: null as number | null, quality: 85 },
  { key: "mobile" as const, suffix: "-800w", width: 800, quality: 80 },
  { key: "desktop" as const, suffix: "-1200w", width: 1200, quality: 80 },
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
  const sources = collectSourceFiles(options.sourceDirectory);
  if (sources.length === 0) {
    throw new Error(`文章插图源目录中没有图片: ${options.sourceDirectory}`);
  }

  const rendererFingerprint = fingerprint([
    fs.readFileSync(fileURLToPath(import.meta.url)),
    JSON.stringify(VARIANTS),
    ...bunImageRendererFingerprintParts(),
  ]);
  const mappings: Record<string, ImageMapping> = {};
  const plans: ArtifactPlan[] = [];
  const usedStems = new Set<string>();

  for (const source of sources) {
    const relativeSource = normalizePath(path.relative(options.sourceDirectory, source));
    const sourceUrl = `/posts/images/${relativeSource}`;
    const stem = relativeSource.slice(0, -path.extname(relativeSource).length);
    if (usedStems.has(stem)) {
      throw new Error(`多个文章插图源文件会生成同名输出: ${stem}`);
    }
    usedStems.add(stem);
    const outputPaths = VARIANTS.map((variant) =>
      path.join(options.outputDirectory, `${stem}${variant.suffix}.webp`),
    );
    plans.push({
      key: sourceUrl,
      fingerprintParts: [rendererFingerprint, fs.readFileSync(source)],
      outputs: outputPaths,
      generate: () => writeVariants(source, outputPaths),
    });

    mappings[sourceUrl] = {
      src: sourceUrl,
      webp: publicUrl(options.outputDirectory, outputPaths[0]),
      mobile: publicUrl(options.outputDirectory, outputPaths[1]),
      desktop: publicUrl(options.outputDirectory, outputPaths[2]),
    };
  }

  const result = await reconcileArtifacts({
    outputDirectory: options.outputDirectory,
    manifestFile: options.manifestFile,
    artifactExtension: ".webp",
    plans,
    recursive: true,
  });
  writeDataFile(options.dataFile, mappings);
  return result;
}

async function writeVariants(source: string, outputs: string[]): Promise<void> {
  for (const output of outputs) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
  }
  await writeWebpVariants(source, outputs, VARIANTS);
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath));
    } else if (
      entry.isFile() &&
      SUPPORTED_SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(entryPath);
    }
  }
  return files.toSorted();
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
