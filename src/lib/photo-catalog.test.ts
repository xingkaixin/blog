import { describe, expect, it } from "vitest";
import { isPhotoArtifactKey, photoIdFromMediaObjectKey } from "@/lib/photo-artifact";
import {
  parsePhotoMonthCatalog,
  parsePhotoRecord,
  photoAvifSrcSet,
  photoHasAvifWidth,
  photoMediaObjectKeys,
  photoVariantSrcSet,
  photoVariantUrl,
  type PhotoMonthCatalog,
} from "@/lib/photo-catalog";

const monthFixture: PhotoMonthCatalog = {
  schemaVersion: 2,
  month: "2026-04",
  photos: [
    {
      id: "0123456789abcdef0123456789abcdef",
      capturedAt: "2026-04-25T21:12:30.244+07:00",
      width: 3024,
      height: 4032,
      albumIds: ["japan-2026"],
      placeholderColor: "#4f5f6a",
    },
  ],
};

describe("photo catalog", () => {
  it("keeps legacy month media readable", () => {
    expect(parsePhotoMonthCatalog({ ...monthFixture, schemaVersion: 1 })).toEqual(monthFixture);
  });

  it("preserves media revisions through parsing and URL generation", () => {
    const photo = { ...monthFixture.photos[0], mediaRevision: "a".repeat(24) };
    const parsed = parsePhotoMonthCatalog({ ...monthFixture, photos: [photo] });
    expect(parsed.photos[0]).toEqual(photo);
    const mediaBase = `/photos/media/${photo.id}/${photo.mediaRevision}`;
    expect(photoVariantUrl("/photos", photo, 960)).toBe(`${mediaBase}/960.webp`);
    expect(photoVariantSrcSet("/photos", photo, [960])).toBe(`${mediaBase}/960.webp 720w`);
    expect(() => parsePhotoRecord({ ...photo, mediaRevision: "../invalid" })).toThrow(
      "mediaRevision",
    );
  });

  it("rejects month shards whose photos belong to another month", () => {
    expect(() =>
      parsePhotoMonthCatalog({
        ...monthFixture,
        photos: [
          {
            ...monthFixture.photos[0],
            capturedAt: "2026-05-01T00:00:00+08:00",
          },
        ],
      }),
    ).toThrow("拍摄月份");
  });

  it("parses avifWidths and builds AVIF srcSets only when supported widths exist", () => {
    const legacy = monthFixture.photos[0];
    expect(photoHasAvifWidth(legacy, 480)).toBe(false);
    expect(photoAvifSrcSet("/photos", legacy)).toBeUndefined();
    expect(photoMediaObjectKeys(legacy)).toEqual([
      `media/${legacy.id}/480.webp`,
      `media/${legacy.id}/960.webp`,
      `media/${legacy.id}/2048.webp`,
    ]);

    const backfilled = parsePhotoRecord({
      ...legacy,
      mediaRevision: "b".repeat(24),
      avifWidths: [480, 960],
    });
    const mediaBase = `/photos/media/${backfilled.id}/${backfilled.mediaRevision}`;
    expect(photoHasAvifWidth(backfilled, 480)).toBe(true);
    expect(photoHasAvifWidth(backfilled, 2048)).toBe(false);
    expect(photoAvifSrcSet("/photos", backfilled)).toBe(
      `${mediaBase}/480.avif 360w, ${mediaBase}/960.avif 720w`,
    );
    expect(photoAvifSrcSet("/photos", backfilled, [960, 2048], true)).toBeUndefined();

    const fullAvif = parsePhotoRecord({
      ...backfilled,
      avifWidths: [480, 960, 2048],
    });
    expect(photoAvifSrcSet("/photos", fullAvif, [960, 2048], true)).toBe(
      `${mediaBase}/960.avif 720w, ${mediaBase}/2048.avif 1536w`,
    );
    expect(isPhotoArtifactKey(`media/${fullAvif.id}/${fullAvif.mediaRevision}/960.avif`)).toBe(
      true,
    );
    expect(photoIdFromMediaObjectKey(`media/${fullAvif.id}/480.avif`)).toBe(fullAvif.id);

    expect(() => parsePhotoRecord({ ...legacy, avifWidths: [] })).toThrow("avifWidths");
    expect(() => parsePhotoRecord({ ...legacy, avifWidths: [960, 480] })).toThrow("升序");
    expect(() => parsePhotoRecord({ ...legacy, avifWidths: [480, 640] })).toThrow("宽度");
  });
});
