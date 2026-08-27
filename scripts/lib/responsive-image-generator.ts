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
  recursive?: boolean;
};

export type GenerateResponsiveImagesResult<Key extends string> = ReconcileArtifactsResult & {
  images: Array<GeneratedResponsiveImage<Key>>;
};

export function collectResponsiveImageFiles(directory: string, recursive: boolean): string[] {
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

export async function generateResponsiveImages<Key extends string>(
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
