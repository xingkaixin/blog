import { describe, expect, it } from "vitest";
import type { PhotoCatalogIndex } from "./photo-catalog";
import { buildPhotoWallCatalogModel } from "./photo-wall-model";

const index: PhotoCatalogIndex = {
  schemaVersion: 3,
  generatedAt: "2026-08-20T12:00:00.000Z",
  albums: [
    { id: "daily", title: "日常" },
    { id: "travel", title: "旅行" },
  ],
  periods: [
    {
      month: "2026-08",
      count: 1,
      albumCounts: { travel: 1 },
      path: "catalog/months/2026-08.111111111111111111111111.json",
    },
    {
      month: "2026-07",
      count: 1,
      albumCounts: { daily: 1 },
      path: "catalog/months/2026-07.222222222222222222222222.json",
    },
  ],
  photoMonths: {
    "11111111111111111111111111111111": "2026-08",
    "22222222222222222222222222222222": "2026-07",
  },
};

describe("photo wall model", () => {
  it("derives timeline periods and totals from the selected album", () => {
    const model = buildPhotoWallCatalogModel(index, "travel");

    expect(model.visiblePeriods.map((period) => period.month)).toEqual(["2026-08"]);
    expect(model.selectedAlbum?.title).toBe("旅行");
    expect(model.albums.map((album) => album.id)).toEqual(["travel", "daily"]);
    expect(model.allPhotoCount).toBe(2);
    expect(model.totalPhotoCount).toBe(1);
    expect(model.timelineRange).toBe("2026年8月");
  });
});
