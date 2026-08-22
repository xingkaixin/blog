import { describe, expect, it, vi } from "vitest";
import {
  PhotoCatalogBrowser,
  overviewLocationHref,
  planPhotoClose,
  planPhotoOpen,
  planPhotoSelection,
  planTimelineOpen,
  planTimelineSelection,
  photoLocationHref,
  photoLookupPeriods,
  readPhotoLocation,
  resolveCatalogPhoto,
  resolvePhotoSelection,
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
  schemaVersion: 2,
  generatedAt: "2026-08-07T12:00:00.000Z",
  albums: [{ id: "trip", title: "旅行" }],
  periods: [period],
  photoMonths: { [photoId]: "2026-04" },
  retiredObjects: [],
  retiredArtifacts: [],
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

  it("starts a new request after reset when the old request resolves later", async () => {
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

  it("normalizes legacy and invalid photo wall URLs", () => {
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
    expect(readPhotoLocation("https://example.com/photos/#album=missing&photo=bad", index)).toEqual(
      {
        href: "https://example.com/photos/#album=",
        photoId: null,
        view: { mode: "timeline", albumId: null },
      },
    );
  });

  it("keeps pushed lightboxes separate from direct photo links", () => {
    const opened = planPhotoOpen(
      "https://example.com/photos/#album=trip",
      { position: 3 },
      photoId,
    );
    expect(opened).toEqual({
      history: "push",
      href: `https://example.com/photos/#album=trip&photo=${photoId}`,
      state: {
        position: 3,
        photoWall: { kind: "lightbox", photoId },
      },
    });
    expect(planPhotoClose(opened.href, opened.state)).toEqual({
      history: "back",
    });
    const directSelection = planPhotoSelection(
      `https://example.com/photos/#photo=${photoId}`,
      null,
      "ffffffffffffffffffffffffffffffff",
    );
    expect(directSelection.state).toEqual({});
    expect(planPhotoClose(directSelection.href, directSelection.state)).toEqual({
      history: "replace",
      href: "https://example.com/photos/",
      state: {},
    });
    expect(planTimelineOpen(opened.href, opened.state, null)).toEqual({
      history: "push",
      href: "https://example.com/photos/#album=",
      state: { position: 3 },
    });
    expect(planTimelineSelection(opened.href, opened.state, "trip")).toEqual({
      history: "replace",
      href: "https://example.com/photos/#album=trip",
      state: { position: 3 },
    });
  });

  it("uses the authoritative locator without scanning unrelated months", () => {
    expect(photoLookupPeriods(index, photoId)).toEqual([period]);
    expect(photoLookupPeriods({ ...index, photoMonths: {} }, photoId)).toEqual([]);
    expect(photoLookupPeriods(index, "ffffffffffffffffffffffffffffffff")).toEqual([]);
  });

  it("resolves photos without scanning when the locator is authoritative", async () => {
    const loadMonth = vi.fn(async () => month);
    await expect(resolveCatalogPhoto(index, photoId, [], loadMonth)).resolves.toEqual(
      month.photos[0],
    );
    expect(loadMonth).toHaveBeenCalledTimes(1);

    loadMonth.mockClear();
    await expect(
      resolveCatalogPhoto(index, "ffffffffffffffffffffffffffffffff", [], loadMonth),
    ).resolves.toBeNull();
    expect(loadMonth).not.toHaveBeenCalled();
  });

  it("classifies retryable photo resolution failures", async () => {
    const resolvePhoto = vi
      .fn<(photoId: string) => Promise<PhotoMonthCatalog["photos"][number] | null>>()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(month.photos[0]);

    await expect(resolvePhotoSelection(photoId, resolvePhoto)).resolves.toMatchObject({
      status: "error",
      message: "network unavailable",
    });
    await expect(resolvePhotoSelection(photoId, resolvePhoto)).resolves.toEqual({
      status: "ready",
      photo: month.photos[0],
    });
  });
});
