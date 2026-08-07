import { describe, expect, it } from "vitest";
import { isSupportedPhoto, resolveCapturedAt, runPhotoCommand } from "./lib/photo-source";

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
    await expect(
      runPhotoCommand(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], 20),
    ).rejects.toThrow("超时");
  });
});
