import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runPhotoCommand } from "./lib/photo-command";
import { isSupportedPhoto, resolveCapturedAt } from "./lib/photo-source";

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
