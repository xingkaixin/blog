#!/usr/bin/env bun

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SUPPORTED_SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MANIFEST_VERSION = 1;
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

type ImageManifest = {
  version: typeof MANIFEST_VERSION;
  entries: Record<string, string>;
};

export async function generatePostImages(
  options: GeneratePostImagesOptions = defaultOptions(),
): Promise<GeneratePostImagesResult> {
  if (!fs.existsSync(options.sourceDirectory)) {
    throw new Error(`文章插图源目录不存在: ${options.sourceDirectory}`);
  }
  fs.mkdirSync(options.outputDirectory, { recursive: true });

  const manifest = readManifest(options.manifestFile);
  const nextManifest: ImageManifest = { version: MANIFEST_VERSION, entries: {} };
  const rendererFingerprint = fingerprint([
    fs.readFileSync(fileURLToPath(import.meta.url)),
    JSON.stringify(VARIANTS),
    JSON.stringify(sharp.versions),
  ]);
  const mappings: Record<string, ImageMapping> = {};
  const expectedOutputs = new Set<string>();
  const usedStems = new Set<string>();
  let generated = 0;
  let reused = 0;

  for (const source of collectSourceFiles(options.sourceDirectory)) {
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
    for (const output of outputPaths) {
      expectedOutputs.add(path.resolve(output));
    }

    const currentFingerprint = fingerprint([rendererFingerprint, fs.readFileSync(source)]);
    nextManifest.entries[sourceUrl] = currentFingerprint;
    if (
      manifest.entries[sourceUrl] === currentFingerprint &&
      outputPaths.every((output) => fs.existsSync(output))
    ) {
      reused += 1;
    } else {
      await writeVariants(source, outputPaths);
      generated += 1;
    }

    mappings[sourceUrl] = {
      src: sourceUrl,
      webp: publicUrl(options.outputDirectory, outputPaths[0]),
      mobile: publicUrl(options.outputDirectory, outputPaths[1]),
      desktop: publicUrl(options.outputDirectory, outputPaths[2]),
    };
  }

  const removed = removeUnexpectedOutputs(options.outputDirectory, expectedOutputs);
  writeDataFile(options.dataFile, mappings);
  writeManifest(options.manifestFile, nextManifest);
  return { generated, reused, removed };
}

async function writeVariants(source: string, outputs: string[]): Promise<void> {
  for (const [index, variant] of VARIANTS.entries()) {
    const output = outputs[index];
    fs.mkdirSync(path.dirname(output), { recursive: true });
    let pipeline = sharp(source);
    if (variant.width !== null) {
      pipeline = pipeline.resize(variant.width, undefined, { withoutEnlargement: true });
    }
    await pipeline.webp({ quality: variant.quality }).toFile(output);
  }
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

function removeUnexpectedOutputs(directory: string, expected: Set<string>): number {
  let removed = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removed += removeUnexpectedOutputs(entryPath, expected);
      if (fs.readdirSync(entryPath).length === 0) {
        fs.rmdirSync(entryPath);
      }
      continue;
    }
    if (
      entry.name === ".DS_Store" ||
      (entry.name.endsWith(".webp") && !expected.has(path.resolve(entryPath)))
    ) {
      fs.rmSync(entryPath);
      removed += 1;
      continue;
    }
    if (!entry.name.endsWith(".webp")) {
      throw new Error(`文章插图公开目录包含非生成文件: ${entryPath}`);
    }
  }
  return removed;
}

function publicUrl(outputDirectory: string, output: string): string {
  return `/posts/images/${normalizePath(path.relative(outputDirectory, output))}`;
}

function writeDataFile(file: string, mappings: Record<string, ImageMapping>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(mappings, null, 2)}\n`, "utf8");
}

function readManifest(file: string): ImageManifest {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<ImageManifest>;
    if (value.version === MANIFEST_VERSION && value.entries && !Array.isArray(value.entries)) {
      return value as ImageManifest;
    }
  } catch {
    return { version: MANIFEST_VERSION, entries: {} };
  }
  return { version: MANIFEST_VERSION, entries: {} };
}

function writeManifest(file: string, manifest: ImageManifest): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function fingerprint(parts: Array<string | Buffer>): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
  }
  return hash.digest("hex");
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
    manifestFile: path.join(root, ".astro", "post-images-manifest.json"),
  };
}

if (import.meta.main) {
  const result = await generatePostImages();
  console.log(
    `✅ 文章插图：生成 ${result.generated}，复用 ${result.reused}，清理 ${result.removed}`,
  );
}
