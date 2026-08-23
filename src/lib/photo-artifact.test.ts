import { describe, expect, it } from "vitest";
import {
  isPhotoArtifactKey,
  isPhotoId,
  isPhotoMonth,
  monthFromPhotoMonthCatalogObjectKey,
  photoIdFromMediaObjectKey,
  photoMediaObjectKey,
  photoMonthCatalogObjectKey,
} from "./photo-artifact";

const photoId = "0123456789abcdef0123456789abcdef";

describe("photo artifact keys", () => {
  it("builds and reads supported object keys", () => {
    const mediaKey = photoMediaObjectKey(photoId, 960);
    const monthKey = photoMonthCatalogObjectKey("2026-08", "0123456789abcdef01234567");

    expect(mediaKey).toBe(`media/${photoId}/960.webp`);
    expect(photoIdFromMediaObjectKey(mediaKey)).toBe(photoId);
    expect(monthKey).toBe("catalog/months/2026-08.0123456789abcdef01234567.json");
    expect(monthFromPhotoMonthCatalogObjectKey(monthKey)).toBe("2026-08");
    expect(isPhotoArtifactKey(mediaKey)).toBe(true);
    expect(isPhotoArtifactKey(monthKey)).toBe(true);
  });

  it("rejects unsupported ids, months, widths and paths", () => {
    expect(isPhotoId(photoId)).toBe(true);
    expect(isPhotoId(`${photoId}0`)).toBe(false);
    expect(isPhotoMonth("2026-08")).toBe(true);
    expect(isPhotoMonth("2026-13")).toBe(false);
    expect(photoIdFromMediaObjectKey(`media/${photoId}/100.webp`)).toBeNull();
    expect(monthFromPhotoMonthCatalogObjectKey("catalog/months/2026-13.hash.json")).toBeNull();
    expect(isPhotoArtifactKey("catalog/index.json")).toBe(false);
  });
});
