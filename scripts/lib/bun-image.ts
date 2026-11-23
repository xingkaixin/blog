import sharp from "sharp";

export type WebpVariant = {
  width: number | null;
  quality: number;
};

export type ImageVariant = WebpVariant;

// 固定可移植后端，使本地与 Linux CI 的缩放结果一致。
Bun.Image.backend = "bun";

// 显式版本，避免 Bun/sharp 升级或脚本重构导致未改动图片的文件名 hash 失效；
// 仅在调整缩放或编码策略、需要全站重出图片时递增。
const RENDERER_VERSION = "v1";
const AVIF_RENDERER_VERSION = "v1";
const AVIF_EFFORT = 4;

export function bunImageRendererFingerprintParts(): string[] {
  return [`bun-image@${RENDERER_VERSION}`];
}

export function avifRendererFingerprintParts(): string[] {
  return [`sharp-avif@${AVIF_RENDERER_VERSION}`];
}

export async function writeWebpVariants(
  source: string,
  outputs: string[],
  variants: WebpVariant[],
): Promise<void> {
  if (outputs.length !== variants.length) {
    throw new Error("图片输出路径与变体数量不一致");
  }

  const metadata = await new Bun.Image(source).metadata();
  for (const [index, variant] of variants.entries()) {
    const image = new Bun.Image(source);
    if (variant.width !== null && variant.width < metadata.width) {
      const height = Math.max(1, Math.round((metadata.height / metadata.width) * variant.width));
      image.resize(variant.width, height);
    }
    await image.webp({ quality: variant.quality }).write(outputs[index]);
  }
}

export async function writeAvifVariants(
  source: string,
  outputs: string[],
  variants: ImageVariant[],
): Promise<void> {
  if (outputs.length !== variants.length) {
    throw new Error("AVIF 图片输出路径与变体数量不一致");
  }

  const metadata = await sharp(source).metadata();
  const sourceWidth = metadata.width ?? 0;
  for (const [index, variant] of variants.entries()) {
    let pipeline = sharp(source);
    if (variant.width !== null && sourceWidth > 0 && variant.width < sourceWidth) {
      pipeline = pipeline.resize({ width: variant.width, withoutEnlargement: true });
    }
    await pipeline.avif({ quality: variant.quality, effort: AVIF_EFFORT }).toFile(outputs[index]);
  }
}
