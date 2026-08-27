import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ExifTool } from "exiftool-vendored";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { photoVariantSrcSet, photoVariantUrl } from "../src/lib/photo-catalog";
import { runPhotoCommand } from "./lib/photo-command";
import { isSupportedPhoto, processPhotoFile, resolveCapturedAt } from "./lib/photo-source";

describe("photo source", () => {
  it("accepts DNG and case variants of supported image extensions", () => {
    expect(isSupportedPhoto("IMG_2971.DNG")).toBe(true);
    expect(isSupportedPhoto("IMG_5355.HEIC")).toBe(true);
    expect(isSupportedPhoto("IMG_2684.JPG")).toBe(true);
  });

  it("does not treat videos or metadata files as photos", () => {
    expect(isSupportedPhoto("IMG_6318.mov")).toBe(false);
    expect(isSupportedPhoto(".DS_Store")).toBe(false);
  });

  it("falls back to a valid EXIF capture time when the subsecond field is invalid", () => {
    expect(
      resolveCapturedAt(
        {
          SubSecDateTimeOriginal: "broken",
          DateTimeOriginal: "2026:04:25 21:12:30",
        },
        "Asia/Shanghai",
      ),
    ).toBe("2026-04-25T21:12:30.000+08:00");
  });

  it.each([
    [1200, 3600],
    [3600, 1200],
    [240, 160],
    [20, 1000],
  ])("describes actual variant widths for a %i×%i photo", async (width, height) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "photo-variants-test-"));
    const exiftool = new ExifTool({ maxProcs: 1 });
    try {
      const source = path.join(directory, "source.jpg");
      await sharp({ create: { width, height, channels: 3, background: "#123456" } })
        .withExif({ IFD2: { DateTimeOriginal: "2026:08:01 12:00:00" } })
        .jpeg()
        .toFile(source);
      const photo = await processPhotoFile(source, "a".repeat(32), exiftool, "Asia/Shanghai");
      const candidates = new Map<number, string>();
      for (const [size, bytes] of photo.variants) {
        const metadata = await sharp(bytes).metadata();
        if (!candidates.has(metadata.width)) {
          candidates.set(
            metadata.width,
            `${photoVariantUrl("/photos", photo, size)} ${metadata.width}w`,
          );
        }
      }
      expect(photoVariantSrcSet("/photos", photo)).toBe([...candidates.values()].join(", "));
    } finally {
      await exiftool.end();
      await fs.rm(directory, { force: true, recursive: true });
    }
  });

  it("terminates photo decoder commands that exceed their timeout", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "photo-command-test-"));
    const pidFile = path.join(directory, "pid");
    await expect(
      runPhotoCommand(
        process.execPath,
        [
          "-e",
          'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)',
          pidFile,
        ],
        100,
      ),
    ).rejects.toThrow("超时");

    const pid = Number(await fs.readFile(pidFile, "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
    await fs.rm(directory, { force: true, recursive: true });
  });
});
