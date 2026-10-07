import { describe, expect, it } from "vitest";
import type { PhotoCatalogIndex, PhotoMonthCatalog } from "./photo-catalog";
import {
  buildOverviewItems,
  buildPhotoWallCatalogModel,
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
  "2026-08": { schemaVersion: 2, month: "2026-08", photos: [firstPhoto] },
  "2026-07": { schemaVersion: 2, month: "2026-07", photos: [secondPhoto] },
};

describe("photo wall model", () => {
  it("keeps previews empty until their required latest months arrive", () => {
    const catalog = buildPhotoWallCatalogModel(index, null);
    const partial = { "2026-07": months["2026-07"] };
    const items = buildOverviewItems(catalog.overviewSummaries, partial, {});
    expect(items.find((item) => item.id === "travel")).toMatchObject({
      status: "loading",
      photos: [],
    });
    expect(items.find((item) => item.id === "daily")?.photos).toEqual([secondPhoto]);
    const failed = buildOverviewItems(catalog.overviewSummaries, partial, { "2026-08": "x" });
    expect(failed.find((item) => item.id === "travel")?.status).toBe("error");
  });
  it("derives timeline periods and totals from the selected album", () => {
    const model = buildPhotoWallCatalogModel(index, "travel");

    expect(model.visiblePeriods.map((period) => period.month)).toEqual(["2026-08"]);
    expect(model.selectedAlbum?.title).toBe("旅行");
    expect(model.companionAlbums.map((album) => album.id)).toEqual(["travel"]);
    expect(model.allPhotoCount).toBe(2);
    expect(model.totalPhotoCount).toBe(1);
    expect(model.timelineRange).toBe("2026年8月");
  });

  it("orders albums by latest visit and groups them by year", () => {
    const catalog = buildPhotoWallCatalogModel(index, null);
    const items = buildOverviewItems(catalog.overviewSummaries, months, {});

    expect(items.map((item) => [item.title, item.count, item.latestMonth])).toEqual([
      ["旅行", 1, "2026.08"],
      ["日常", 1, "2026.07"],
    ]);
    expect(items[0].photos).toEqual([firstPhoto]);
    expect(catalog.journeyYears).toEqual([
      {
        year: "2026",
        albums: [
          { id: "travel", title: "旅行", count: 1 },
          { id: "daily", title: "日常", count: 1 },
        ],
      },
    ]);
    expect(catalog.overviewPeriods).toEqual(index.periods);
  });

  it("formats single-month and cross-year ranges", () => {
    expect(formatPeriodRange(index.periods.slice(0, 1))).toBe("2026年8月");
    expect(formatPeriodRange([index.periods[0], { ...index.periods[1], month: "2025-07" }])).toBe(
      "2025 – 2026",
    );
  });
});
