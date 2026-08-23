import { describe, expect, it } from "vitest";
import {
  PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
  parseLegacyPhotoCatalogControl,
  parsePhotoCatalogControl,
  photoCatalogIndexFromControl,
  type PhotoCatalogControl,
} from "./lib/photo-catalog-control";

const photoId = "0123456789abcdef0123456789abcdef";
const periodPath = "catalog/months/2026-04.0123456789abcdef01234567.json";
const controlFixture: PhotoCatalogControl = {
  schemaVersion: PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
  generatedAt: "2026-07-30T12:00:00.000Z",
  albums: [{ id: "japan-2026", title: "日本旅行" }],
  periods: [
    {
      month: "2026-04",
      count: 1,
      albumCounts: { "japan-2026": 1 },
      path: periodPath,
    },
  ],
  photoMonths: { [photoId]: "2026-04" },
  retiredObjects: [],
  retiredArtifacts: [],
};

describe("photo catalog control", () => {
  it("keeps backend state out of the public projection", () => {
    expect(photoCatalogIndexFromControl(controlFixture)).toEqual({
      schemaVersion: 3,
      generatedAt: controlFixture.generatedAt,
      albums: controlFixture.albums,
      periods: controlFixture.periods,
      photoMonths: controlFixture.photoMonths,
    });
  });

  it.each([1, 2])("migrates combined catalog version %i", (version) => {
    expect(parseLegacyPhotoCatalogControl({ ...controlFixture, schemaVersion: version })).toEqual(
      controlFixture,
    );
  });

  it("validates retired immutable artifacts", () => {
    const retired = parsePhotoCatalogControl({
      ...controlFixture,
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
    });
    expect(retired.retiredArtifacts).toHaveLength(1);
    expect(() =>
      parsePhotoCatalogControl({
        ...controlFixture,
        retiredArtifacts: [
          {
            retirementId: "abcdef0123456789abcdef01",
            objectKeys: [periodPath],
            deleteAfter: "2026-08-08T13:00:00.000Z",
          },
        ],
      }),
    ).toThrow("仍被主 Catalog 引用");
  });

  it("validates retired object tombstones", () => {
    const retiredPhotoId = "ffffffffffffffffffffffffffffffff";
    const retired = parsePhotoCatalogControl({
      ...controlFixture,
      retiredObjects: [
        {
          photoId: retiredPhotoId,
          objectKeys: [`media/${retiredPhotoId}/960.webp`, periodPath],
          deleteAfter: "2026-08-08T13:00:00.000Z",
        },
      ],
    });
    expect(retired.retiredObjects).toHaveLength(1);
    expect(() =>
      parsePhotoCatalogControl({
        ...controlFixture,
        retiredObjects: [
          {
            photoId,
            objectKeys: [`media/${photoId}/960.webp`],
            deleteAfter: "2026-08-08T13:00:00.000Z",
          },
        ],
      }),
    ).toThrow("不能同时");
  });

  it("rejects invalid retirement timestamps", () => {
    expect(() =>
      parsePhotoCatalogControl({
        ...controlFixture,
        retiredObjects: [
          {
            photoId: "ffffffffffffffffffffffffffffffff",
            objectKeys: ["media/ffffffffffffffffffffffffffffffff/960.webp"],
            deleteAfter: "2026-02-30T12:00:00+08:00",
          },
        ],
      }),
    ).toThrow("ISO 时间");
  });
});
