import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ExifDateTime, type ExifTool, type Tags } from "exiftool-vendored";
import sharp from "sharp";
import {
  PHOTO_VARIANT_WIDTHS,
  type PhotoRecord,
  type PhotoVariantWidth,
} from "../../src/lib/photo-catalog";

const SUPPORTED_EXTENSIONS = new Set([".dng", ".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp"]);
const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);
const WEBP_QUALITY = 82;
const WEBP_EFFORT = 4;
const MAX_SOURCE_BYTES = 256 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 100_000_000;
const HEIC_DECODE_TIMEOUT_MS = 60_000;

export type ProcessedPhoto = Omit<PhotoRecord, "albumIds"> & {
  variants: Map<PhotoVariantWidth, Uint8Array>;
};

export type PhotoSourceSnapshot = {
  file: string;
  source: string;
  id: string;
  dispose: () => Promise<void>;
};

export async function collectPhotoFiles(inputs: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const input of inputs) {
    const resolved = path.resolve(input);
    const stats = await fs.stat(resolved);

    if (stats.isDirectory()) {
      await collectDirectoryPhotos(resolved, files);
      continue;
    }
    if (!stats.isFile() || !isSupportedPhoto(resolved)) {
      throw new Error(`不支持的照片文件: ${resolved}`);
    }
    files.push(resolved);
  }

  return [...new Set(files)].toSorted();
}

async function collectDirectoryPhotos(directory: string, output: string[]): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectDirectoryPhotos(entryPath, output);
    } else if (entry.isFile() && isSupportedPhoto(entryPath)) {
      output.push(entryPath);
    }
  }
}

export function isSupportedPhoto(file: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase());
}

export async function hashPhotoFile(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
  }
  return hash.digest("hex").slice(0, 32);
}

export async function snapshotPhotoFile(file: string): Promise<PhotoSourceSnapshot> {
  await assertSourceSize(file);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "photo-source-"));
  const source = path.join(directory, `source${path.extname(file).toLowerCase()}`);
  try {
    await fs.copyFile(file, source);
    const id = await hashPhotoFile(source);
    return {
      file,
      source,
      id,
      dispose: () => fs.rm(directory, { force: true, recursive: true }),
    };
  } catch (error) {
    await fs.rm(directory, { force: true, recursive: true });
    throw error;
  }
}

export function resolveCapturedAt(
  tags: Pick<Tags, "SubSecDateTimeOriginal" | "DateTimeOriginal">,
  fallbackTimezone?: string,
): string {
  const capturedAt = [tags.SubSecDateTimeOriginal, tags.DateTimeOriginal]
    .map(parseExifDateTime)
    .find((candidate) => candidate?.isValid);

  if (!capturedAt?.isValid) {
    throw new Error("照片缺少有效的原始拍摄时间");
  }

  if (capturedAt.hasZone) {
    const timestamp = capturedAt.toISOString();
    if (timestamp) {
      return timestamp;
    }
  }

  if (!fallbackTimezone) {
    throw new Error("照片拍摄时间没有时区，请通过 --timezone 指定拍摄地时区");
  }

  const timestamp = capturedAt
    .toDateTime(fallbackTimezone)
    .toISO({ includeOffset: true, suppressMilliseconds: false });
  if (!timestamp) {
    throw new Error(`无法使用时区 ${fallbackTimezone} 解释照片拍摄时间`);
  }
  return timestamp;
}

export async function processPhotoFile(
  file: string,
  id: string,
  exiftool: ExifTool,
  fallbackTimezone?: string,
): Promise<ProcessedPhoto> {
  await assertSourceSize(file);
  const temporaryDirectory = HEIC_EXTENSIONS.has(path.extname(file).toLowerCase())
    ? await fs.mkdtemp(path.join(os.tmpdir(), "photo-publish-"))
    : null;

  try {
    const [tags, decodedSource] = await Promise.all([
      exiftool.read(file),
      temporaryDirectory ? decodeHeic(file, temporaryDirectory) : file,
    ]);
    const capturedAt = resolveCapturedAt(tags, fallbackTimezone);
    const metadata = await sharp(decodedSource, {
      autoOrient: true,
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
    const { width, height } = metadata.autoOrient;
    if (!width || !height || width * height > MAX_IMAGE_PIXELS) {
      throw new Error(`照片像素不能超过 ${MAX_IMAGE_PIXELS}`);
    }

    const [placeholderColor, variants] = await Promise.all([
      readPlaceholderColor(decodedSource),
      buildVariants(decodedSource),
    ]);

    return {
      id,
      capturedAt,
      width,
      height,
      placeholderColor,
      variants,
    };
  } finally {
    if (temporaryDirectory) {
      await fs.rm(temporaryDirectory, { force: true, recursive: true });
    }
  }
}

async function readPlaceholderColor(source: string): Promise<string> {
  const pixel = await sharp(source, {
    autoOrient: true,
    failOn: "warning",
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .resize(1, 1, { fit: "fill" })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer();

  const [red = 0, green = 0, blue = 0] = pixel;
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

async function buildVariants(source: string): Promise<Map<PhotoVariantWidth, Uint8Array>> {
  const variants = new Map<PhotoVariantWidth, Uint8Array>();

  for (const width of PHOTO_VARIANT_WIDTHS) {
    const data = await sharp(source, {
      autoOrient: true,
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .resize({
        width,
        height: width,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColourspace("srgb")
      .webp({
        quality: WEBP_QUALITY,
        effort: WEBP_EFFORT,
        smartSubsample: true,
      })
      .toBuffer();
    variants.set(width, data);
  }

  return variants;
}

async function decodeHeic(file: string, temporaryDirectory: string): Promise<string> {
  const output = path.join(temporaryDirectory, "decoded.png");
  const attempts =
    process.platform === "darwin"
      ? [
          { command: "sips", args: ["-s", "format", "png", file, "--out", output] },
          { command: "heif-convert", args: [file, output] },
        ]
      : [{ command: "heif-convert", args: [file, output] }];
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      await fs.rm(output, { force: true });
      await runPhotoCommand(attempt.command, attempt.args, HEIC_DECODE_TIMEOUT_MS);
      await fs.access(output);
      return output;
    } catch (error) {
      errors.push(`${attempt.command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`无法解码 HEIC 照片 ${file}\n${errors.join("\n")}`);
}

export function runPhotoCommand(command: string, args: string[], timeoutMs: number): Promise<void> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("照片命令超时必须是正整数");
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let finished = false;
    const complete = (error?: Error) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      complete(new Error(`执行 ${command} 超时（${timeoutMs}ms）`));
    }, timeoutMs);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < 32_000) {
        stderr = `${stderr}${chunk}`.slice(0, 32_000);
      }
    });
    child.once("error", (error) => complete(error));
    child.once("close", (code) => {
      if (code === 0) {
        complete();
      } else {
        complete(new Error(stderr.trim() || `退出码 ${code ?? "unknown"}`));
      }
    });
  });
}

function parseExifDateTime(value: unknown): ExifDateTime | null {
  if (value instanceof ExifDateTime) {
    return value;
  }
  return typeof value === "string" ? (ExifDateTime.from(value) ?? null) : null;
}

async function assertSourceSize(file: string): Promise<void> {
  const stats = await fs.stat(file);
  if (!stats.isFile() || stats.size > MAX_SOURCE_BYTES) {
    throw new Error(`照片文件不能超过 ${MAX_SOURCE_BYTES} 字节: ${file}`);
  }
}
