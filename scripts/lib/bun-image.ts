import fs from "node:fs";
import { fileURLToPath } from "node:url";

export type WebpVariant = {
  width: number | null;
  quality: number;
};

// 固定可移植后端，使本地与 Linux CI 的缩放结果一致。
Bun.Image.backend = "bun";

export function bunImageRendererFingerprintParts(): Array<string | Buffer> {
  return [fs.readFileSync(fileURLToPath(import.meta.url)), `bun-image@${Bun.version}`];
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
