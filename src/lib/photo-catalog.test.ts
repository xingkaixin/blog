import { describe, expect, it } from "vitest";
import {
  catalogIndexUrl,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  photoVariantUrl,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
} from "@/lib/photo-catalog";

const indexFixture: PhotoCatalogIndex = {
  schemaVersion: 1,
  generatedAt: "2026-07-30T12:00:00.000Z",
  albums: [{ id: "japan-2026", title: "日本旅行" }],
  periods: [
    {
      month: "2026-04",
      count: 1,
      albumCounts: { "japan-2026": 1 },
      path: "catalog/months/2026-04.0123456789abcdef01234567.json",
    },
  ],
};

const monthFixture: PhotoMonthCatalog = {
  schemaVersion: 1,
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
  it("parses a valid index and month shard", () => {
    expect(parsePhotoCatalogIndex(indexFixture)).toEqual(indexFixture);
    expect(parsePhotoMonthCatalog(monthFixture)).toEqual(monthFixture);
  });

  it("rejects month shards whose photos belong to another month", () => {
    expect(() =>
      parsePhotoMonthCatalog({
        ...monthFixture,
        photos: [{ ...monthFixture.photos[0], capturedAt: "2026-05-01T00:00:00+08:00" }],
      }),
    ).toThrow("拍摄月份");
  });

  it("rejects unknown album references in the index", () => {
    expect(() =>
      parsePhotoCatalogIndex({
        ...indexFixture,
        periods: [{ ...indexFixture.periods[0], albumCounts: { missing: 1 } }],
      }),
    ).toThrow("不存在的相册");
  });

  it("derives catalog and media URLs from one base URL", () => {
    expect(catalogIndexUrl("https://photos.example.com/")).toBe(
      "https://photos.example.com/catalog/index.json",
    );
    expect(photoVariantUrl("/photo-preview/", "0123456789abcdef0123456789abcdef", 960)).toBe(
      "/photo-preview/media/0123456789abcdef0123456789abcdef/960.webp",
    );
  });
});
