#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint, reconcileArtifacts, type ArtifactPlan } from "./lib/artifact-reconciler";
import { bunImageRendererFingerprintParts, writeWebpVariants } from "./lib/bun-image";

const SUPPORTED_SOURCE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);
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

export async function generateCovers(
  options: GenerateCoversOptions = defaultOptions(),
): Promise<GenerateCoversResult> {
  if (!fs.existsSync(options.sourceDirectory)) {
    throw new Error(`封面源目录不存在: ${options.sourceDirectory}`);
  }
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

  const rendererFingerprint = fingerprint([
    fs.readFileSync(fileURLToPath(import.meta.url)),
    JSON.stringify(VARIANTS),
    ...bunImageRendererFingerprintParts(),
  ]);
  const mappings: Record<string, CoverMapping> = {};
  const plans: ArtifactPlan[] = [];
  const usedStems = new Set<string>();

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
    plans.push({
      key: filename,
      fingerprintParts: [rendererFingerprint, fs.readFileSync(source)],
      outputs: outputPaths,
      generate: () => writeVariants(source, outputPaths),
    });

    mappings[filename] = Object.fromEntries(
      VARIANTS.map((variant, index) => [
        variant.key,
        `/cover/${path.basename(outputPaths[index])}`,
      ]),
    ) as CoverMapping;
  }

  const result = await reconcileArtifacts({
    outputDirectory: options.outputDirectory,
    manifestFile: options.manifestFile,
    artifactExtension: ".webp",
    plans,
  });
  writeDataFile(options.dataFile, mappings);
  return result;
}

async function writeVariants(source: string, outputs: string[]): Promise<void> {
  await writeWebpVariants(source, outputs, VARIANTS);
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
    manifestFile: path.join(root, ".astro", "cover-manifest.json"),
  };
}

if (import.meta.main) {
  const result = await generateCovers();
  console.log(`✅ 封面：生成 ${result.generated}，复用 ${result.reused}，清理 ${result.removed}`);
}
