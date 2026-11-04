import { describe, expect, it } from "vitest";
import {
  parsePhotoMonthCatalog,
  parsePhotoRecord,
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
});
