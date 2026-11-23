import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  fingerprint,
  reconcileArtifacts,
  withArtifactDirectoryLock,
  type ArtifactPlan,
  type ReconcileArtifactsResult,
} from "./artifact-reconciler";
import {
  avifRendererFingerprintParts,
  bunImageRendererFingerprintParts,
  writeAvifVariants,
  writeWebpVariants,
  type WebpVariant,
} from "./bun-image";

const SOURCE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);

export type ResponsiveImageVariant<Key extends string> = WebpVariant & {
  key: Key;
  suffix: string;
};

export type ResponsiveImageSource = {
  key: string;
  file: string;
  stem: string;
};

export type ResponsiveImageSetOptions = {
  sourceDirectory: string;
  outputDirectory: string;
  dataFile: string;
  manifestFile: string;
};

type ResponsiveImageSetSpecification<Key extends string, AvifKey extends string = never> = {
  assetName: string;
  variants: Array<ResponsiveImageVariant<Key>>;
  avifVariants?: Array<ResponsiveImageVariant<AvifKey>>;
  metadataVariant: Key;
  recursive: boolean;
  source: (file: string) => ResponsiveImageSource;
  url: (output: string) => string;
};

type ResponsiveImageMapping<Key extends string> = Record<Key, string> & {
  width: number;
  height: number;
};

type GeneratedResponsiveImage<Key extends string> = {
  key: string;
  outputs: Record<Key, string>;
};

type GenerateResponsiveImagesOptions<Key extends string, AvifKey extends string = never> = {
  assetName: string;
  outputDirectory: string;
  manifestFile: string;
  variants: Array<ResponsiveImageVariant<Key>>;
  avifVariants?: Array<ResponsiveImageVariant<AvifKey>>;
  sources: ResponsiveImageSource[];
  recursive: boolean;
};

type GenerateResponsiveImagesResult<Key extends string> = ReconcileArtifactsResult & {
  images: Array<GeneratedResponsiveImage<Key>>;
};

export function generateResponsiveImageSet<Key extends string, AvifKey extends string = never>(
  options: ResponsiveImageSetOptions,
  specification: ResponsiveImageSetSpecification<Key, AvifKey>,
): Promise<ReconcileArtifactsResult> {
  return withArtifactDirectoryLock(options.outputDirectory, () =>
    writeResponsiveImageSet(options, specification),
  );
}

async function writeResponsiveImageSet<Key extends string, AvifKey extends string = never>(
  options: ResponsiveImageSetOptions,
  specification: ResponsiveImageSetSpecification<Key, AvifKey>,
): Promise<ReconcileArtifactsResult> {
  if (!fs.existsSync(options.sourceDirectory)) {
    throw new Error(`${specification.assetName}源目录不存在: ${options.sourceDirectory}`);
  }
  const sources = collectResponsiveImageFiles(options.sourceDirectory, specification.recursive);
  if (sources.length === 0) {
    throw new Error(`${specification.assetName}源目录中没有图片: ${options.sourceDirectory}`);
  }

  const result = await generateResponsiveImages({
    assetName: specification.assetName,
    outputDirectory: options.outputDirectory,
    manifestFile: options.manifestFile,
    variants: specification.variants,
    avifVariants: specification.avifVariants,
    recursive: specification.recursive,
    sources: sources.map(specification.source),
  });
  const allVariants: Array<ResponsiveImageVariant<Key | AvifKey>> = [
    ...specification.variants,
    ...(specification.avifVariants ?? []),
  ];
  const mappings: Record<string, ResponsiveImageMapping<Key | AvifKey>> = {};
  for (const image of result.images) {
    const { width, height } = await new Bun.Image(
      image.outputs[specification.metadataVariant],
    ).metadata();
    const urls = Object.fromEntries(
      allVariants.map((variant) => [variant.key, specification.url(image.outputs[variant.key])]),
    ) as Record<Key | AvifKey, string>;
    mappings[image.key] = { ...urls, width, height };
  }
  fs.mkdirSync(path.dirname(options.dataFile), { recursive: true });
  fs.writeFileSync(options.dataFile, `${JSON.stringify(mappings, null, 2)}\n`, "utf8");
  return { generated: result.generated, reused: result.reused, removed: result.removed };
}

export function defaultResponsiveImageSetOptions(paths: {
  source: string;
  output: string;
  data: string;
}): ResponsiveImageSetOptions {
  const root = process.cwd();
  return {
    sourceDirectory: path.join(root, "src", "assets", paths.source),
    outputDirectory: path.join(root, "public", paths.output),
    dataFile: path.join(root, "src", "lib", "generated", `${paths.data}.json`),
    manifestFile: path.join(root, "src", "lib", "generated", `${paths.data}-manifest.json`),
  };
}

function collectResponsiveImageFiles(directory: string, recursive: boolean): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...collectResponsiveImageFiles(entryPath, true));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files.toSorted();
}

async function generateResponsiveImages<Key extends string, AvifKey extends string = never>(
  options: GenerateResponsiveImagesOptions<Key, AvifKey>,
): Promise<GenerateResponsiveImagesResult<Key | AvifKey>> {
  const webpRendererFingerprint = fingerprint([
    JSON.stringify(options.variants),
    ...bunImageRendererFingerprintParts(),
  ]);
  const avifVariants = options.avifVariants ?? [];
  const avifRendererFingerprint =
    avifVariants.length > 0
      ? fingerprint([JSON.stringify(avifVariants), ...avifRendererFingerprintParts()])
      : "";
  const usedStems = new Set<string>();
  const plans: ArtifactPlan[] = [];
  const images = options.sources.map((source): GeneratedResponsiveImage<Key | AvifKey> => {
    if (usedStems.has(source.stem)) {
      throw new Error(`多个${options.assetName}源文件会生成同名输出: ${source.stem}`);
    }
    usedStems.add(source.stem);

    const sourceBytes = fs.readFileSync(source.file);
    // WebP 与 AVIF 使用各自独立的显式版本指纹，新增或调整 AVIF 不会让既有 WebP 文件名变化。
    const webpSourceFingerprint = fingerprint([webpRendererFingerprint, sourceBytes]);
    const webpHash = webpSourceFingerprint.slice(0, 8);
    const webpEntries = options.variants.map(
      (variant) =>
        [
          variant.key as Key | AvifKey,
          path.join(options.outputDirectory, `${source.stem}${variant.suffix}.${webpHash}.webp`),
        ] as const,
    );
    const webpOutputs = webpEntries.map(([, output]) => output);

    const avifSourceFingerprint =
      avifVariants.length > 0 ? fingerprint([avifRendererFingerprint, sourceBytes]) : "";
    const avifHash = avifSourceFingerprint.slice(0, 8);
    const avifEntries = avifVariants.map(
      (variant) =>
        [
          variant.key as Key | AvifKey,
          path.join(options.outputDirectory, `${source.stem}${variant.suffix}.${avifHash}.avif`),
        ] as const,
    );
    const avifOutputs = avifEntries.map(([, output]) => output);

    const allEntries = [...webpEntries, ...avifEntries];
    const allOutputs = [...webpOutputs, ...avifOutputs];
    const combinedFingerprint =
      avifVariants.length > 0
        ? fingerprint([webpSourceFingerprint, avifSourceFingerprint])
        : webpSourceFingerprint;

    plans.push({
      key: source.key,
      fingerprint: () => combinedFingerprint,
      outputs: allOutputs,
      generate: async () => {
        for (const output of allOutputs) {
          fs.mkdirSync(path.dirname(output), { recursive: true });
        }
        // 文件名已包含对应格式的显式版本与源字节指纹；已存在时跳过重写，避免另一格式变更扰动既有产物。
        if (!webpOutputs.every((output) => fs.existsSync(output))) {
          await writeWebpVariants(source.file, webpOutputs, options.variants);
        }
        if (avifVariants.length > 0 && !avifOutputs.every((output) => fs.existsSync(output))) {
          await writeAvifVariants(source.file, avifOutputs, avifVariants);
        }
      },
    });
    return {
      key: source.key,
      outputs: Object.fromEntries(allEntries) as Record<Key | AvifKey, string>,
    };
  });

  const concurrency = Math.max(1, Math.min(os.availableParallelism(), 8));
  const result = await reconcileArtifacts({
    outputDirectory: options.outputDirectory,
    manifestFile: options.manifestFile,
    artifactExtension: avifVariants.length > 0 ? [".webp", ".avif"] : ".webp",
    plans,
    recursive: options.recursive,
    concurrency,
  });
  return { ...result, images };
}
