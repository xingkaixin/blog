#!/usr/bin/env bun

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DEFAULT_INPUT = path.join(ROOT, "src/assets/footer/article-footer-master.png");
const DEFAULT_OUT_DIR = path.join(ROOT, "src/assets/footer");
const TARGET_ASPECT = 1440 / 400; // Matches SceneFooter.astro (.footer-art 400/1440)

type CropRect = { left: number; top: number; width: number; height: number };

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Find the painted content bounds on a pure-white background, then expand to TARGET_ASPECT
 * with breathing room above so footer typography sits on open sky.
 */
function detectPanoramicCrop(
  rgb: Uint8Array,
  width: number,
  height: number,
  aspect: number,
): CropRect {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const r = rgb[idx];
      const g = rgb[idx + 1];
      const b = rgb[idx + 2];
      if (r < 245 || g < 245 || b < 245) {
        if (x < minX) {
          minX = x;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    const cropH = Math.min(height, Math.round(width / aspect));
    return { left: 0, top: Math.round((height - cropH) / 2), width, height: cropH };
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;

  // Leave room at bottom so .footer-bottom glass bar does not cover water reflections.
  const padTop = Math.round(contentH * 0.06);
  const padBottom = Math.round(contentH * 0.11);
  const padX = Math.round(contentW * 0.02);

  let desiredH = Math.min(height, contentH + padTop + padBottom);
  let desiredW = Math.round(desiredH * aspect);

  if (desiredW > width) {
    desiredW = width;
    desiredH = Math.min(height, Math.round(desiredW / aspect));
  } else if (desiredW < contentW + padX * 2) {
    desiredW = Math.min(width, contentW + padX * 2);
    desiredH = Math.min(height, Math.round(desiredW / aspect));
  }

  const centerX = (minX + maxX) / 2;
  const left = clamp(Math.round(centerX - desiredW / 2), 0, width - desiredW);

  // Align content near the lower portion of the banner so treetops and reflections both fit.
  const desiredBottom = Math.min(height, maxY + padBottom);
  let top = desiredBottom - desiredH;
  if (top > minY - padTop) {
    top = Math.round((minY + maxY) / 2 - desiredH / 2);
  }
  top = clamp(top, 0, height - desiredH);

  return { left, top, width: desiredW, height: desiredH };
}

/**
 * Separate a white-paper ink-and-watercolor painting into:
 * - lineGray: 1-channel opaque grayscale (0 = paper, 255 = ink stroke)
 * - washRgba: 4-channel straight RGBA watercolor wash with ink strokes cleanly inpainted
 */
function separateInkAndWash(
  rgb: Uint8Array,
  width: number,
  height: number,
): { lineGray: Uint8Array; washRgba: Uint8Array } {
  const count = width * height;
  const lineFloat = new Float32Array(count);
  const inkMask = new Float32Array(count);

  // Pass 1: classify crisp dark fountain-pen strokes (combine local darkness contrast + deep neutral ink)
  // so broad soft gray/green watercolor washes stay in the wash layer rather than clogging linework.
  const lumaBuf = new Float32Array(count);
  const chromaBuf = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = rgb[i * 3] / 255;
    const g = rgb[i * 3 + 1] / 255;
    const b = rgb[i * 3 + 2] / 255;
    lumaBuf[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    chromaBuf[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }

  // Separable box blur (radius 4) of luminance to measure local stroke contrast.
  const blurTmp = new Float32Array(count);
  const blurLuma = new Float32Array(count);
  const R = 4;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          sum += lumaBuf[row + nx];
          n++;
        }
      }
      blurTmp[row + x] = sum / n;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -R; dy <= R; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          sum += blurTmp[ny * width + x];
          n++;
        }
      }
      blurLuma[y * width + x] = sum / n;
    }
  }

  for (let i = 0; i < count; i++) {
    const luma = lumaBuf[i];
    const chroma = chromaBuf[i];
    const darkness = 1 - luma;
    const neutral = 1 - smoothstep(0.06, 0.24, chroma);
    // Local stroke darker than surrounding 9x9 neighborhood catches crisp fine pen lines.
    const localDip = Math.max(0, blurLuma[i] - luma);
    const crispLine = smoothstep(0.04, 0.22, localDip) * smoothstep(0.14, 0.35, darkness);
    // Very dark neutral ink (deep outlines / hatching intersections) always belongs to line layer.
    const solidInk = smoothstep(0.5, 0.78, darkness) * (0.35 + 0.65 * neutral);

    const strength = clamp(Math.max(crispLine * (0.45 + 0.55 * neutral), solidInk), 0, 1);
    lineFloat[i] = strength;
    inkMask[i] = strength;
  }

  // Pass 2: clean subtle watercolor pigment under ink lines via iterative masked diffusion.
  const workR = new Float32Array(count);
  const workG = new Float32Array(count);
  const workB = new Float32Array(count);
  const weight = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    workR[i] = rgb[i * 3] / 255;
    workG[i] = rgb[i * 3 + 1] / 255;
    workB[i] = rgb[i * 3 + 2] / 255;
    // Pixels with strong ink start with low confidence so surrounding wash flows in.
    weight[i] = 1 - smoothstep(0.12, 0.45, inkMask[i]);
  }

  const nextR = new Float32Array(count);
  const nextG = new Float32Array(count);
  const nextB = new Float32Array(count);
  const nextW = new Float32Array(count);

  const OFFSETS = [
    [-1, 0, 1.0],
    [1, 0, 1.0],
    [0, -1, 1.0],
    [0, 1, 1.0],
    [-1, -1, 0.7],
    [1, -1, 0.7],
    [-1, 1, 0.7],
    [1, 1, 0.7],
  ] as const;

  // 8 diffusion passes smoothly fill up to ~6px wide pen lines & cross-hatching.
  for (let pass = 0; pass < 8; pass++) {
    nextR.set(workR);
    nextG.set(workG);
    nextB.set(workB);
    nextW.set(weight);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (inkMask[i] <= 0.12) {
          continue;
        }
        let sumR = workR[i] * weight[i];
        let sumG = workG[i] * weight[i];
        let sumB = workB[i] * weight[i];
        let sumW = weight[i];

        for (const [dx, dy, k] of OFFSETS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            continue;
          }
          const ni = ny * width + nx;
          const w = weight[ni] * k;
          if (w > 0.001) {
            sumR += workR[ni] * w;
            sumG += workG[ni] * w;
            sumB += workB[ni] * w;
            sumW += w;
          }
        }

        if (sumW > 0.001) {
          nextR[i] = sumR / sumW;
          nextG[i] = sumG / sumW;
          nextB[i] = sumB / sumW;
          nextW[i] = Math.min(1, sumW / 4);
        }
      }
    }

    workR.set(nextR);
    workG.set(nextG);
    workB.set(nextB);
    weight.set(nextW);
  }

  // Pass 3: pack final line grayscale and unblended straight-RGBA watercolor wash.
  const lineGray = new Uint8Array(count);
  const washRgba = new Uint8Array(count * 4);

  for (let i = 0; i < count; i++) {
    // Threshold out tiny background noise below ~3% so grayscale compression is spotless.
    const lineVal = lineFloat[i] < 0.03 ? 0 : lineFloat[i];
    lineGray[i] = Math.round(clamp(lineVal, 0, 1) * 255);

    const r = clamp(workR[i], 0, 1);
    const g = clamp(workG[i], 0, 1);
    const b = clamp(workB[i], 0, 1);

    // Distance from pure white paper determines watercolor coverage alpha.
    const minC = Math.min(r, g, b);
    const distFromWhite = 1 - minC;
    const rawAlpha = smoothstep(0.025, 0.06, distFromWhite) * clamp(distFromWhite * 1.15, 0, 1);

    if (rawAlpha < 0.01) {
      washRgba[i * 4] = 255;
      washRgba[i * 4 + 1] = 255;
      washRgba[i * 4 + 2] = 255;
      washRgba[i * 4 + 3] = 0;
      continue;
    }

    // Recover straight pigment color from white-paper composite: obs = (1 - a) * 1 + a * pig
    const invA = 1 / Math.max(rawAlpha, 0.08);
    const pigR = clamp((r - (1 - rawAlpha)) * invA, 0.05, 1);
    const pigG = clamp((g - (1 - rawAlpha)) * invA, 0.05, 1);
    const pigB = clamp((b - (1 - rawAlpha)) * invA, 0.05, 1);

    washRgba[i * 4] = Math.round(pigR * 255);
    washRgba[i * 4 + 1] = Math.round(pigG * 255);
    washRgba[i * 4 + 2] = Math.round(pigB * 255);
    washRgba[i * 4 + 3] = Math.round(clamp(rawAlpha, 0, 1) * 255);
  }

  return { lineGray, washRgba };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeDebug = args.has("--debug");
  const inputPath = DEFAULT_INPUT;
  const outDir = DEFAULT_OUT_DIR;

  await fs.mkdir(outDir, { recursive: true });

  const master = sharp(inputPath).flatten({ background: "#ffffff" }).removeAlpha();
  const { data: fullRgb, info: fullInfo } = await master
    .raw()
    .toBuffer({ resolveWithObject: true });

  const crop = detectPanoramicCrop(fullRgb, fullInfo.width, fullInfo.height, TARGET_ASPECT);
  console.log(
    `Master: ${fullInfo.width}x${fullInfo.height} -> Crop: ${crop.width}x${crop.height} at (${crop.left}, ${crop.top})`,
  );

  // Extract cropped RGB at full master resolution before layer separation.
  const { data: croppedRgb, info: cropInfo } = await sharp(inputPath)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .extract(crop)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { lineGray, washRgba } = separateInkAndWash(croppedRgb, cropInfo.width, cropInfo.height);

  const lineRaw = { raw: { width: cropInfo.width, height: cropInfo.height, channels: 1 as const } };
  const washRaw = { raw: { width: cropInfo.width, height: cropInfo.height, channels: 4 as const } };

  const outputs = [
    {
      name: "article-line-desktop.avif",
      build: () =>
        sharp(lineGray, lineRaw)
          .resize(1200)
          .avif({ quality: 50, effort: 6 })
          .toFile(path.join(outDir, "article-line-desktop.avif")),
    },
    {
      name: "article-line-desktop.webp",
      build: () =>
        sharp(lineGray, lineRaw)
          .resize(1200)
          .webp({ quality: 75, effort: 6 })
          .toFile(path.join(outDir, "article-line-desktop.webp")),
    },
    {
      name: "article-line-mobile.avif",
      build: () =>
        sharp(lineGray, lineRaw)
          .resize(800)
          .avif({ quality: 50, effort: 6 })
          .toFile(path.join(outDir, "article-line-mobile.avif")),
    },
    {
      name: "article-line-mobile.webp",
      build: () =>
        sharp(lineGray, lineRaw)
          .resize(800)
          .webp({ quality: 75, effort: 6 })
          .toFile(path.join(outDir, "article-line-mobile.webp")),
    },
    {
      name: "article-wash-desktop.avif",
      build: () =>
        sharp(washRgba, washRaw)
          .resize(800)
          .avif({ quality: 45, effort: 6 })
          .toFile(path.join(outDir, "article-wash-desktop.avif")),
    },
    {
      name: "article-wash-desktop.webp",
      build: () =>
        sharp(washRgba, washRaw)
          .resize(800)
          .webp({ quality: 65, alphaQuality: 60, effort: 6 })
          .toFile(path.join(outDir, "article-wash-desktop.webp")),
    },
    {
      name: "article-wash-mobile.avif",
      build: () =>
        sharp(washRgba, washRaw)
          .resize(480)
          .avif({ quality: 45, effort: 6 })
          .toFile(path.join(outDir, "article-wash-mobile.avif")),
    },
    {
      name: "article-wash-mobile.webp",
      build: () =>
        sharp(washRgba, washRaw)
          .resize(480)
          .webp({ quality: 65, alphaQuality: 60, effort: 6 })
          .toFile(path.join(outDir, "article-wash-mobile.webp")),
    },
  ];

  const results = await Promise.all(
    outputs.map(async (item) => {
      const info = await item.build();
      return { name: item.name, width: info.width, height: info.height, size: info.size };
    }),
  );

  for (const r of results) {
    console.log(`  ${r.name.padEnd(28)} ${r.width}x${r.height}  ${(r.size / 1024).toFixed(1)} KB`);
  }

  if (writeDebug) {
    await Promise.all([
      sharp(lineGray, lineRaw).png().toFile(path.join(outDir, ".debug-line.png")),
      sharp(washRgba, washRaw)
        .flatten({ background: "#f4f6f5" })
        .png()
        .toFile(path.join(outDir, ".debug-wash-on-paper.png")),
    ]);
    console.log("  Wrote .debug-line.png and .debug-wash-on-paper.png");
  }
}

if (import.meta.main) {
  await main();
}
