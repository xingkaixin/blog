import { describe, expect, it } from "vitest";
import type { PhotoCatalogIndex, PhotoMonthCatalog } from "./photo-catalog";
import {
  buildPhotoWallCatalogModel,
  buildPhotoWallModel,
  formatPeriodRange,
} from "./photo-wall-model";

const firstPhoto = {
  id: "11111111111111111111111111111111",
  capturedAt: "2026-08-10T12:00:00+08:00",
  width: 1200,
  height: 800,
  albumIds: ["travel"],
  placeholderColor: "#112233",
};
const secondPhoto = {
  id: "22222222222222222222222222222222",
  capturedAt: "2026-07-10T12:00:00+08:00",
  width: 800,
  height: 1200,
  albumIds: ["daily"],
  placeholderColor: "#445566",
};
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
  photoMonths: { [firstPhoto.id]: "2026-08", [secondPhoto.id]: "2026-07" },
};
const months: Record<string, PhotoMonthCatalog> = {
  "2026-08": { schemaVersion: 1, month: "2026-08", photos: [firstPhoto] },
  "2026-07": { schemaVersion: 1, month: "2026-07", photos: [secondPhoto] },
};

describe("photo wall model", () => {
  it("derives timeline periods and totals from the selected album", () => {
    const catalog = buildPhotoWallCatalogModel(index, { mode: "timeline", albumId: "travel" });
    const model = buildPhotoWallModel(catalog, months);

    expect(model.visiblePeriods.map((period) => period.month)).toEqual(["2026-08"]);
    expect(model.selectedAlbum?.title).toBe("旅行");
    expect(model.albumSummaries.map((album) => [album.title, album.count])).toEqual([
      ["日常", 1],
      ["旅行", 1],
    ]);
    expect(model.allPhotoCount).toBe(2);
    expect(model.totalPhotoCount).toBe(1);
    expect(model.timelineRange).toBe("2026年8月");
  });

  it("derives overview previews and loaded lightbox photos in catalog order", () => {
    const catalog = buildPhotoWallCatalogModel(index, { mode: "timeline", albumId: "daily" });
    const model = buildPhotoWallModel(catalog, months);

    expect(model.allPhotos.map((photo) => photo.id)).toEqual([firstPhoto.id, secondPhoto.id]);
    expect(model.filteredPhotos.map((photo) => photo.id)).toEqual([secondPhoto.id]);
    expect(model.overviewItems.map((item) => [item.title, item.count])).toEqual([
      ["全部", 2],
      ["日常", 1],
      ["旅行", 1],
    ]);
    expect(model.overviewItems.find((item) => item.id === "daily")?.photos).toEqual([secondPhoto]);
    expect(model.overviewItems.find((item) => item.id === "travel")?.photos).toEqual([firstPhoto]);
    expect(model.overviewPeriods).toEqual(index.periods);
  });

  it("preserves catalog-derived references when loaded months change", () => {
    const catalog = buildPhotoWallCatalogModel(index, { mode: "overview" });
    const initial = buildPhotoWallModel(catalog, {});
    const loaded = buildPhotoWallModel(catalog, months);

    expect(loaded.visiblePeriods).toBe(initial.visiblePeriods);
    expect(loaded.overviewPeriods).toBe(initial.overviewPeriods);
  });

  it("formats single-month and cross-year ranges", () => {
    expect(formatPeriodRange(index.periods.slice(0, 1))).toBe("2026年8月");
    expect(formatPeriodRange([index.periods[0], { ...index.periods[1], month: "2025-07" }])).toBe(
      "2025 – 2026",
    );
  });
});
