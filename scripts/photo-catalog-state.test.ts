import { describe, expect, it } from "vitest";
import { PHOTO_MONTH_CATALOG_SCHEMA_VERSION } from "../src/lib/photo-catalog";
import { parsePhotoCatalogControl } from "./lib/photo-catalog-control";
import { PhotoCatalogState } from "./lib/photo-catalog-state";

const photoId = "a".repeat(32);
const month = "2026-08";

function loadedCatalog(): PhotoCatalogState {
  const control = parsePhotoCatalogControl({
    schemaVersion: 1,
    generatedAt: "2026-08-23T08:00:00.000Z",
    albums: [{ id: "trip", title: "旅行" }],
    periods: [
      {
        month,
        count: 1,
        albumCounts: {},
        path: `catalog/months/${month}.aaaaaaaaaaaaaaaaaaaaaaaa.json`,
      },
    ],
    photoMonths: { [photoId]: month },
    retiredObjects: [],
    retiredArtifacts: [],
  });
  return PhotoCatalogState.loaded(control, {
    control: "control-version",
    publicIndex: "index-version",
    publicIndexCurrent: true,
  });
}

describe("photo catalog state", () => {
  it("rejects an album update when the photo month is not loaded", () => {
    const catalog = loadedCatalog();

    expect(() => catalog.addPhotoToAlbum(photoId, "trip")).toThrow(
      `照片 ${photoId} 所属月份 ${month} 尚未加载或内容不完整`,
    );
  });

  it("adds a loaded photo to an album only once", () => {
    const catalog = loadedCatalog();
    catalog.loadMonth({
      schemaVersion: PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
      month,
      photos: [
        {
          id: photoId,
          capturedAt: "2026-08-20T12:00:00.000+08:00",
          width: 1200,
          height: 800,
          albumIds: [],
          placeholderColor: "#abcdef",
        },
      ],
    });

    expect(catalog.addPhotoToAlbum(photoId, "trip")).toBe(true);
    expect(catalog.addPhotoToAlbum(photoId, "trip")).toBe(false);
    expect(catalog.monthForWrite(month)?.photos[0].albumIds).toEqual(["trip"]);
  });
});
