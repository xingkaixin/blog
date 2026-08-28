import { describe, expect, it } from "vitest";
import {
  PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
  artifactRetirementId,
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

  it("parses its own persisted contract without a public index version", () => {
    expect(parsePhotoCatalogControl(controlFixture)).toEqual(controlFixture);
    expect(
      parsePhotoCatalogControl({ ...controlFixture, schemaVersion: 1, retiredObjects: [] }),
    ).toEqual(controlFixture);
    expect(() => parsePhotoCatalogControl({ ...controlFixture, schemaVersion: 5 })).toThrow(
      "后台控制文档版本",
    );
  });

  it.each([1, 2])("migrates combined catalog version %i", (version) => {
    expect(
      parseLegacyPhotoCatalogControl({
        ...controlFixture,
        schemaVersion: version,
        retiredObjects: [],
      }),
    ).toEqual(controlFixture);
  });

  it.each([1, 2])("requires publication confirmation for v%i retirements", (schemaVersion) => {
    const retired = {
      photoId: "f".repeat(32),
      objectKeys: [`media/${"f".repeat(32)}/960.webp`],
      deleteAfter: "2026-08-08T13:00:00.000Z",
      deletion: { id: "a".repeat(24), expiresAt: "2026-08-09T13:00:00.000Z" },
    };
    const control = parsePhotoCatalogControl({
      ...controlFixture,
      schemaVersion,
      retiredObjects: [retired],
    });
    expect(control.retiredArtifacts).toEqual([
      {
        retirementId: artifactRetirementId(retired.objectKeys),
        objectKeys: retired.objectKeys,
        deleteAfter: null,
        deletion: undefined,
      },
    ]);
    expect(parsePhotoCatalogControl(control)).toEqual(control);
  });

  it("rejects deletion claims without a confirmed publication", () => {
    expect(() =>
      parsePhotoCatalogControl({
        ...controlFixture,
        retiredArtifacts: [
          {
            retirementId: "a".repeat(24),
            objectKeys: [`media/${"f".repeat(32)}/960.webp`],
            deleteAfter: null,
            deletion: { id: "b".repeat(24), expiresAt: "2026-08-09T13:00:00.000Z" },
          },
        ],
      }),
    ).toThrow("尚未确认公开索引");
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

  it("migrates v3 photo retirements without losing their schedule or claim", () => {
    const objectKeys = [`media/${"f".repeat(32)}/960.webp`];
    const schedule = {
      deleteAfter: "2026-08-08T13:00:00.000Z",
      deletion: { id: "a".repeat(24), expiresAt: "2026-08-09T13:00:00.000Z" },
    };
    const control = parsePhotoCatalogControl({
      ...controlFixture,
      schemaVersion: 3,
      retiredObjects: [{ photoId: "f".repeat(32), objectKeys, ...schedule }],
    });
    expect(control.retiredArtifacts).toEqual([
      { retirementId: artifactRetirementId(objectKeys), objectKeys, ...schedule },
    ]);
    expect(control).not.toHaveProperty("retiredObjects");
    expect(parsePhotoCatalogControl(control)).toEqual(control);
  });

  it("rejects invalid retirement timestamps", () => {
    expect(() =>
      parsePhotoCatalogControl({
        ...controlFixture,
        schemaVersion: 3,
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
