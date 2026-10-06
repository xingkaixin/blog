import fs from "node:fs";
import path from "node:path";
import {
  fingerprint,
  reconcileArtifacts,
  type ArtifactPlan,
  type ReconcileArtifactsResult,
} from "./artifact-reconciler";
import { bunImageRendererFingerprintParts, writeWebpVariants, type WebpVariant } from "./bun-image";

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

type ResponsiveImageSetSpecification<Key extends string> = {
  assetName: string;
  variants: Array<ResponsiveImageVariant<Key>>;
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

type GenerateResponsiveImagesOptions<Key extends string> = {
  assetName: string;
  outputDirectory: string;
  manifestFile: string;
  variants: Array<ResponsiveImageVariant<Key>>;
  sources: ResponsiveImageSource[];
  recursive: boolean;
};

type GenerateResponsiveImagesResult<Key extends string> = ReconcileArtifactsResult & {
  images: Array<GeneratedResponsiveImage<Key>>;
};

export async function generateResponsiveImageSet<Key extends string>(
  options: ResponsiveImageSetOptions,
  specification: ResponsiveImageSetSpecification<Key>,
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
    recursive: specification.recursive,
    sources: sources.map(specification.source),
  });
  const mappings: Record<string, ResponsiveImageMapping<Key>> = {};
  for (const image of result.images) {
    const { width, height } = await new Bun.Image(
      image.outputs[specification.metadataVariant],
    ).metadata();
    const urls = Object.fromEntries(
      specification.variants.map((variant) => [
        variant.key,
        specification.url(image.outputs[variant.key]),
      ]),
    ) as Record<Key, string>;
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

async function generateResponsiveImages<Key extends string>(
  options: GenerateResponsiveImagesOptions<Key>,
): Promise<GenerateResponsiveImagesResult<Key>> {
  const rendererFingerprint = fingerprint([
    JSON.stringify(options.variants),
    ...bunImageRendererFingerprintParts(),
  ]);
  const usedStems = new Set<string>();
  const plans: ArtifactPlan[] = [];
  const images = options.sources.map((source): GeneratedResponsiveImage<Key> => {
    if (usedStems.has(source.stem)) {
      throw new Error(`多个${options.assetName}源文件会生成同名输出: ${source.stem}`);
    }
    usedStems.add(source.stem);

    const outputEntries = options.variants.map(
      (variant) =>
        [
          variant.key,
          path.join(options.outputDirectory, `${source.stem}${variant.suffix}.webp`),
        ] as const,
    );
    const outputPaths = outputEntries.map(([, output]) => output);
    plans.push({
      key: source.key,
      fingerprint: () => fingerprint([rendererFingerprint, fs.readFileSync(source.file)]),
      outputs: outputPaths,
      generate: async () => {
        for (const output of outputPaths) {
          fs.mkdirSync(path.dirname(output), { recursive: true });
        }
        await writeWebpVariants(source.file, outputPaths, options.variants);
      },
    });
    return {
      key: source.key,
      outputs: Object.fromEntries(outputEntries) as Record<Key, string>,
    };
  });

  const result = await reconcileArtifacts({
    outputDirectory: options.outputDirectory,
    manifestFile: options.manifestFile,
    artifactExtension: ".webp",
    plans,
    recursive: options.recursive,
  });
  return { ...result, images };
}
