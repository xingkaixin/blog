import { describe, expect, it } from "vitest";
import {
  PHOTO_DISPLAY_WIDTH,
  catalogIndexUrl,
  isPhotoId,
  locatePhotoPeriod,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  parsePhotoRecord,
  photoVariantSrcSet,
  photoVariantUrl,
  validatePhotoMonth,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
} from "@/lib/photo-catalog";

const indexFixture: PhotoCatalogIndex = {
  schemaVersion: 3,
  generatedAt: "2026-07-30T12:00:00.000Z",
  albums: [{ id: "japan-2026", title: "日本旅行" }],
  photoMonths: { "0123456789abcdef0123456789abcdef": "2026-04" },
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
  it("recognizes content-addressed photo IDs", () => {
    expect(isPhotoId("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isPhotoId("0123456789ABCDEF0123456789ABCDEF")).toBe(false);
    expect(isPhotoId("0123456789abcdef")).toBe(false);
  });

  it("parses a valid index and month shard", () => {
    expect(parsePhotoCatalogIndex(indexFixture)).toEqual(indexFixture);
    expect(parsePhotoMonthCatalog(monthFixture)).toEqual(monthFixture);
  });

  it("parses a photo without manufacturing a month shard", () => {
    expect(parsePhotoRecord(monthFixture.photos[0])).toEqual(monthFixture.photos[0]);
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

  it("rejects timestamps with impossible calendar dates", () => {
    expect(() =>
      parsePhotoMonthCatalog({
        ...monthFixture,
        photos: [
          {
            ...monthFixture.photos[0],
            capturedAt: "2026-02-30T12:00:00+08:00",
          },
        ],
      }),
    ).toThrow("ISO 时间");
  });

  it("rejects unknown album references in the index", () => {
    expect(() =>
      parsePhotoCatalogIndex({
        ...indexFixture,
        periods: [{ ...indexFixture.periods[0], albumCounts: { missing: 1 } }],
      }),
    ).toThrow("不存在的相册");
  });

  it("validates index and shard invariants at runtime boundaries", () => {
    expect(validatePhotoMonth(indexFixture, indexFixture.periods[0], monthFixture)).toEqual(
      monthFixture,
    );
    expect(() =>
      validatePhotoMonth(
        {
          ...indexFixture,
          periods: [{ ...indexFixture.periods[0], albumCounts: {} }],
        },
        { ...indexFixture.periods[0], albumCounts: {} },
        monthFixture,
      ),
    ).toThrow("相册计数");
    const unknownAlbumPeriod = {
      ...indexFixture.periods[0],
      albumCounts: { missing: 1 },
    };
    expect(() =>
      validatePhotoMonth({ ...indexFixture, periods: [unknownAlbumPeriod] }, unknownAlbumPeriod, {
        ...monthFixture,
        photos: [{ ...monthFixture.photos[0], albumIds: ["missing"] }],
      }),
    ).toThrow("不存在的相册");
  });

  it("locates a photo without scanning month shards", () => {
    expect(locatePhotoPeriod(indexFixture, monthFixture.photos[0].id)).toEqual(
      indexFixture.periods[0],
    );
    expect(locatePhotoPeriod(indexFixture, "ffffffffffffffffffffffffffffffff")).toBeNull();
  });

  it("migrates the previous public index without exposing control state", () => {
    expect(
      parsePhotoCatalogIndex({
        ...indexFixture,
        schemaVersion: 2,
        retiredObjects: [],
        retiredArtifacts: [],
      }),
    ).toEqual(indexFixture);
  });

  it("rejects unsupported indexes instead of pretending they are compatible", () => {
    const incomplete = structuredClone(indexFixture) as unknown as Record<string, unknown>;
    incomplete.schemaVersion = 1;

    expect(() => parsePhotoCatalogIndex(incomplete)).toThrow("不支持的照片 Catalog 版本");
  });

  it("rejects an empty locator when indexed periods contain photos", () => {
    expect(() => parsePhotoCatalogIndex({ ...indexFixture, photoMonths: {} })).toThrow(
      "catalog.photoMonths 必须完整覆盖所有照片",
    );
  });

  it("requires every loaded photo to have an exact locator", () => {
    expect(() =>
      validatePhotoMonth(
        { ...indexFixture, photoMonths: {} },
        indexFixture.periods[0],
        monthFixture,
      ),
    ).toThrow("定位月份");
  });

  it("derives catalog and media URLs from one base URL", () => {
    expect(catalogIndexUrl("https://photos.example.com/")).toBe(
      "https://photos.example.com/catalog/index.json",
    );
    expect(
      photoVariantUrl("/photo-preview/", "0123456789abcdef0123456789abcdef", PHOTO_DISPLAY_WIDTH),
    ).toBe("/photo-preview/media/0123456789abcdef0123456789abcdef/960.webp");
    expect(photoVariantSrcSet("/photo-preview/", "0123456789abcdef0123456789abcdef")).toBe(
      "/photo-preview/media/0123456789abcdef0123456789abcdef/480.webp 480w, /photo-preview/media/0123456789abcdef0123456789abcdef/960.webp 960w, /photo-preview/media/0123456789abcdef0123456789abcdef/2048.webp 2048w",
    );
  });
});
