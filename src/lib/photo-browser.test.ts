import { describe, expect, it, vi } from "vitest";
import {
  PhotoCatalogBrowser,
  overviewLocationHref,
  planPhotoClose,
  photoHistoryState,
  photoLocationHref,
  photoLookupPeriods,
  readPhotoLocation,
  timelineLocationHref,
  type PhotoCatalogRequest,
} from "@/lib/photo-browser";
import type { PhotoCatalogIndex, PhotoMonthCatalog } from "@/lib/photo-catalog";

const photoId = "0123456789abcdef0123456789abcdef";
const period = {
  month: "2026-04",
  count: 1,
  albumCounts: { trip: 1 },
  path: "catalog/months/2026-04.0123456789abcdef01234567.json",
};
const index: PhotoCatalogIndex = {
  schemaVersion: 1,
  generatedAt: "2026-08-07T12:00:00.000Z",
  albums: [{ id: "trip", title: "旅行" }],
  periods: [period],
  photoMonths: { [photoId]: "2026-04" },
  retiredObjects: [],
};
const month: PhotoMonthCatalog = {
  schemaVersion: 1,
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
  it("deduplicates month requests and retries failures", async () => {
    const request = vi
      .fn<PhotoCatalogRequest>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(month);
    const browser = new PhotoCatalogBrowser("https://photos.example.com", request);

    await expect(browser.loadMonth(index, period)).rejects.toThrow("offline");
    const first = browser.loadMonth(index, period);
    const second = browser.loadMonth(index, period);
    await expect(Promise.all([first, second])).resolves.toEqual([month, month]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not let a response from a reset session populate the new cache", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const request = vi
      .fn<PhotoCatalogRequest>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(month);
    const browser = new PhotoCatalogBrowser("https://photos.example.com", request);

    const stale = browser.loadMonth(index, period);
    browser.reset();
    resolveFirst?.(month);
    await stale;
    await browser.loadMonth(index, period);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("normalizes legacy album URLs and preserves explicit photo history", () => {
    const location = readPhotoLocation(
      `https://example.com/photos/?album=trip#photo=${photoId}`,
      index,
    );
    expect(location).toEqual({
      href: `https://example.com/photos/#photo=${photoId}&album=trip`,
      photoId,
      view: { mode: "timeline", albumId: "trip" },
    });
    expect(timelineLocationHref(location.href, null)).toBe("https://example.com/photos/#album=");
    expect(photoLocationHref(location.href, null)).toBe("https://example.com/photos/#album=trip");
    expect(overviewLocationHref(location.href)).toBe("https://example.com/photos/");
    expect(photoHistoryState({ position: 3 }, photoId)).toEqual({
      position: 3,
      photoWall: true,
      photoId,
    });
    expect(planPhotoClose(location.href, photoHistoryState(null, photoId))).toEqual({
      history: "back",
    });
    expect(planPhotoClose(location.href, null)).toEqual({
      history: "replace",
      href: "https://example.com/photos/#album=trip",
    });
  });

  it("uses the direct locator and falls back for a legacy catalog", () => {
    expect(photoLookupPeriods(index, photoId)).toEqual([period]);
    expect(photoLookupPeriods({ ...index, photoMonths: {} }, photoId)).toEqual([period]);
  });
});
