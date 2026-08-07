#!/usr/bin/env bun

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SUPPORTED_SOURCE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);
const MANIFEST_VERSION = 1;
const VARIANTS = [
  { key: "mobile" as const, suffix: "-400", width: 400, quality: 82 },
  { key: "desktop" as const, suffix: "-800", width: 800, quality: 82 },
  { key: "full" as const, suffix: "", width: null as number | null, quality: 85 },
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

type CoverManifest = {
  version: typeof MANIFEST_VERSION;
  entries: Record<string, string>;
};

export async function generateCovers(
  options: GenerateCoversOptions = defaultOptions(),
): Promise<GenerateCoversResult> {
  if (!fs.existsSync(options.sourceDirectory)) {
    throw new Error(`封面源目录不存在: ${options.sourceDirectory}`);
  }
  fs.mkdirSync(options.outputDirectory, { recursive: true });

  const sources = fs
    .readdirSync(options.sourceDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && SUPPORTED_SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => entry.name)
    .toSorted();
  if (sources.length === 0) {
    throw new Error(`封面源目录中没有图片: ${options.sourceDirectory}`);
  }

  const manifest = readManifest(options.manifestFile);
  const nextManifest: CoverManifest = { version: MANIFEST_VERSION, entries: {} };
  const rendererFingerprint = fingerprint([
    fs.readFileSync(fileURLToPath(import.meta.url)),
    JSON.stringify(VARIANTS),
    JSON.stringify(sharp.versions),
  ]);
  const mappings: Record<string, CoverMapping> = {};
  const expectedOutputs = new Set<string>();
  const usedStems = new Set<string>();
  let generated = 0;
  let reused = 0;

  for (const filename of sources) {
    const source = path.join(options.sourceDirectory, filename);
    const stem = filename.slice(0, -path.extname(filename).length);
    if (usedStems.has(stem)) {
      throw new Error(`多个封面源文件会生成同名输出: ${stem}`);
    }
    usedStems.add(stem);
    const outputPaths = VARIANTS.map((variant) =>
      path.join(options.outputDirectory, `${stem}${variant.suffix}.webp`),
    );
    for (const output of outputPaths) {
      expectedOutputs.add(path.resolve(output));
    }

    const currentFingerprint = fingerprint([rendererFingerprint, fs.readFileSync(source)]);
    nextManifest.entries[filename] = currentFingerprint;
    if (
      manifest.entries[filename] === currentFingerprint &&
      outputPaths.every((output) => fs.existsSync(output))
    ) {
      reused += 1;
    } else {
      await writeVariants(source, outputPaths);
      generated += 1;
    }

    mappings[filename] = Object.fromEntries(
      VARIANTS.map((variant, index) => [
        variant.key,
        `/cover/${path.basename(outputPaths[index])}`,
      ]),
    ) as CoverMapping;
  }

  const removed = removeUnexpectedOutputs(options.outputDirectory, expectedOutputs);
  writeDataFile(options.dataFile, mappings);
  writeManifest(options.manifestFile, nextManifest);
  return { generated, reused, removed };
}

async function writeVariants(source: string, outputs: string[]): Promise<void> {
  for (const [index, variant] of VARIANTS.entries()) {
    let pipeline = sharp(source);
    if (variant.width !== null) {
      pipeline = pipeline.resize(variant.width, undefined, { withoutEnlargement: true });
    }
    await pipeline.webp({ quality: variant.quality }).toFile(outputs[index]);
  }
}

function removeUnexpectedOutputs(directory: string, expected: Set<string>): number {
  let removed = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (!entry.isFile()) {
      throw new Error(`封面公开目录包含非文件条目: ${entryPath}`);
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
      throw new Error(`封面公开目录包含非生成文件: ${entryPath}`);
    }
  }
  return removed;
}

function writeDataFile(file: string, mappings: Record<string, CoverMapping>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(mappings, null, 2)}\n`, "utf8");
}

function readManifest(file: string): CoverManifest {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<CoverManifest>;
    if (value.version === MANIFEST_VERSION && value.entries && !Array.isArray(value.entries)) {
      return value as CoverManifest;
    }
  } catch {
    return { version: MANIFEST_VERSION, entries: {} };
  }
  return { version: MANIFEST_VERSION, entries: {} };
}

function writeManifest(file: string, manifest: CoverManifest): void {
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

function defaultOptions(): GenerateCoversOptions {
  const root = process.cwd();
  return {
    sourceDirectory: path.join(root, "src", "assets", "cover"),
    outputDirectory: path.join(root, "public", "cover"),
    dataFile: path.join(root, "src", "lib", "generated", "covers.json"),
    manifestFile: path.join(root, ".astro", "cover-manifest.json"),
  };
}

if (import.meta.main) {
  const result = await generateCovers();
  console.log(`✅ 封面：生成 ${result.generated}，复用 ${result.reused}，清理 ${result.removed}`);
}
