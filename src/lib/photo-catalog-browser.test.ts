import { describe, expect, it } from "vitest";
import type { PhotoCatalogIndex, PhotoMonthCatalog } from "@/lib/photo-catalog";
import { planPhotoNavigation } from "@/lib/photo-catalog-browser";

const photoId = "0123456789abcdef0123456789abcdef";
const period = {
  month: "2026-04",
  count: 1,
  albumCounts: { trip: 1 },
  path: "catalog/months/2026-04.0123456789abcdef01234567.json",
};
const index: PhotoCatalogIndex = {
  schemaVersion: 3,
  generatedAt: "2026-08-07T12:00:00.000Z",
  albums: [{ id: "trip", title: "旅行" }],
  periods: [period],
  photoMonths: { [photoId]: "2026-04" },
};
const month: PhotoMonthCatalog = {
  schemaVersion: 2,
  month: "2026-04",
  photos: [
    {
      id: photoId,
      capturedAt: "2026-04-25T21:12:30.244+07:00",
      width: 3024,
      height: 4032,
      albumIds: ["trip"],
      placeholderColor: "#4f5f6a",
    },
  ],
};

describe("photo catalog browser", () => {
  it("waits for an unloaded month instead of skipping to a cached later photo", () => {
    const periods = ["2026-04", "2026-03", "2026-02"].map((month) => ({
      ...period,
      month,
      path: `catalog/months/${month}.0123456789abcdef01234567.json`,
    }));
    const catalogs = Object.fromEntries(
      periods.map((period, i) => [
        period.month,
        {
          ...month,
          month: period.month,
          photos: [
            {
              ...month.photos[0],
              id: String(i).repeat(32),
              capturedAt: `${period.month}-25T21:12:30.244+07:00`,
            },
          ],
        },
      ]),
    );
    const catalog = {
      ...index,
      periods,
      photoMonths: Object.fromEntries(
        Object.values(catalogs).map((month) => [month.photos[0].id, month.month]),
      ),
    };
    const selected = catalogs["2026-04"].photos[0];
    expect(
      planPhotoNavigation(catalog, selected, "trip", {
        "2026-04": catalogs["2026-04"],
        "2026-02": catalogs["2026-02"],
      }),
    ).toEqual({
      navigation: {
        previous: undefined,
        next: undefined,
        position: 1,
        total: 3,
        strip: [selected],
      },
      pendingPeriods: [periods[1]],
    });
    expect(planPhotoNavigation(catalog, selected, "trip", catalogs)).toEqual({
      navigation: {
        previous: undefined,
        next: catalogs["2026-03"].photos[0],
        position: 1,
        total: 3,
        strip: [selected],
      },
      pendingPeriods: [],
    });
  });
});
