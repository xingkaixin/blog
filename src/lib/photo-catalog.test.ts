import { describe, expect, it } from "vitest";
import {
  catalogIndexUrl,
  isPhotoId,
  locatePhotoPeriod,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  parsePhotoRecord,
  photoVariantUrl,
  validatePhotoCatalog,
  validatePhotoMonth,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
} from "@/lib/photo-catalog";

const indexFixture: PhotoCatalogIndex = {
  schemaVersion: 1,
  generatedAt: "2026-07-30T12:00:00.000Z",
  albums: [{ id: "japan-2026", title: "日本旅行" }],
  photoMonths: { "0123456789abcdef0123456789abcdef": "2026-04" },
  retiredObjects: [],
  retiredArtifacts: [],
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
        photos: [{ ...monthFixture.photos[0], capturedAt: "2026-05-01T00:00:00+08:00" }],
      }),
    ).toThrow("拍摄月份");
  });

  it("rejects timestamps with impossible calendar dates", () => {
    expect(() =>
      parsePhotoMonthCatalog({
        ...monthFixture,
        photos: [{ ...monthFixture.photos[0], capturedAt: "2026-02-30T12:00:00+08:00" }],
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

  it("validates index and shard invariants through one module", () => {
    expect(validatePhotoMonth(indexFixture, indexFixture.periods[0], monthFixture)).toEqual(
      monthFixture,
    );
    expect(validatePhotoCatalog(indexFixture, [monthFixture]).photoMonths).toEqual(
      new Map([[monthFixture.photos[0].id, "2026-04"]]),
    );

    expect(() =>
      validatePhotoMonth(
        { ...indexFixture, periods: [{ ...indexFixture.periods[0], albumCounts: {} }] },
        { ...indexFixture.periods[0], albumCounts: {} },
        monthFixture,
      ),
    ).toThrow("相册计数");
    const unknownAlbumPeriod = { ...indexFixture.periods[0], albumCounts: { missing: 1 } };
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

  it("accepts a legacy index without a locator for migration", () => {
    const legacy = structuredClone(indexFixture) as unknown as Record<string, unknown>;
    delete legacy.photoMonths;
    delete legacy.retiredObjects;
    delete legacy.retiredArtifacts;

    expect(parsePhotoCatalogIndex(legacy).photoMonths).toEqual({});
    expect(parsePhotoCatalogIndex(legacy).retiredObjects).toEqual([]);
    expect(parsePhotoCatalogIndex(legacy).retiredArtifacts).toEqual([]);
  });

  it("validates retired immutable artifacts", () => {
    expect(
      parsePhotoCatalogIndex({
        ...indexFixture,
        retiredArtifacts: [
          {
            retirementId: "abcdef0123456789abcdef01",
            objectKeys: [
              "catalog/months/2026-04.ffffffffffffffffffffffff.json",
              "media/ffffffffffffffffffffffffffffffff/960.webp",
            ],
            deleteAfter: "2026-08-08T13:00:00.000Z",
          },
        ],
      }).retiredArtifacts,
    ).toHaveLength(1);
    expect(() =>
      parsePhotoCatalogIndex({
        ...indexFixture,
        retiredArtifacts: [
          {
            retirementId: "abcdef0123456789abcdef01",
            objectKeys: [indexFixture.periods[0].path],
            deleteAfter: "2026-08-08T13:00:00.000Z",
          },
        ],
      }),
    ).toThrow("仍被主 Catalog 引用");
  });

  it("validates retired object tombstones", () => {
    const photoId = "ffffffffffffffffffffffffffffffff";
    expect(
      parsePhotoCatalogIndex({
        ...indexFixture,
        retiredObjects: [
          {
            photoId,
            objectKeys: [`media/${photoId}/960.webp`, indexFixture.periods[0].path],
            deleteAfter: "2026-08-08T13:00:00.000Z",
          },
        ],
      }).retiredObjects,
    ).toHaveLength(1);
    expect(() =>
      parsePhotoCatalogIndex({
        ...indexFixture,
        retiredObjects: [
          {
            photoId: monthFixture.photos[0].id,
            objectKeys: [`media/${monthFixture.photos[0].id}/960.webp`],
            deleteAfter: "2026-08-08T13:00:00.000Z",
          },
        ],
      }),
    ).toThrow("不能同时");
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
