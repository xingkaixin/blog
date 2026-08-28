import { describe, expect, it, vi } from "vitest";
import type { PhotoCatalogIndex, PhotoMonthCatalog } from "@/lib/photo-catalog";
import {
  PhotoCatalogBrowser,
  planPhotoNavigation,
  resolveCatalogPhoto,
  resolvePhotoSelection,
  type PhotoCatalogRequest,
} from "@/lib/photo-catalog-browser";

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
      navigation: { previous: undefined, next: undefined, position: 1, total: 3 },
      pendingPeriods: [periods[1]],
    });
    expect(planPhotoNavigation(catalog, selected, "trip", catalogs)).toEqual({
      navigation: {
        previous: undefined,
        next: catalogs["2026-03"].photos[0],
        position: 1,
        total: 3,
      },
      pendingPeriods: [],
    });
  });

  it("navigates within a month without loading other periods", () => {
    const photos = ["f", "e", "d", "c"].map((id, index) => ({
      ...month.photos[0],
      id: id.repeat(32),
      albumIds: index === 1 ? [] : ["trip"],
    }));
    const catalog = {
      ...index,
      periods: [{ ...period, count: 4, albumCounts: { trip: 3 } }],
      photoMonths: Object.fromEntries(photos.map((photo) => [photo.id, month.month])),
    };

    expect(
      planPhotoNavigation(catalog, photos[2], "trip", { [month.month]: { ...month, photos } }),
    ).toEqual({
      navigation: { previous: photos[0], next: photos[3], position: 2, total: 3 },
      pendingPeriods: [],
    });
  });

  it("uses the full catalog for a linked photo outside the selected album", () => {
    const otherPhoto = {
      ...month.photos[0],
      id: "f".repeat(32),
      capturedAt: "2026-04-24T21:12:30.244+07:00",
      albumIds: ["other"],
    };
    const catalog = {
      ...index,
      albums: [...index.albums, { id: "other", title: "其他" }],
      periods: [{ ...period, count: 2, albumCounts: { trip: 1, other: 1 } }],
      photoMonths: { ...index.photoMonths, [otherPhoto.id]: month.month },
    };
    const loaded = { [month.month]: { ...month, photos: [...month.photos, otherPhoto] } };

    expect(planPhotoNavigation(catalog, month.photos[0], "other", loaded)).toEqual({
      navigation: { previous: undefined, next: otherPhoto, position: 1, total: 2 },
      pendingPeriods: [],
    });
  });

  it("retries failed month requests", async () => {
    const request = vi
      .fn<PhotoCatalogRequest>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(month);
    const browser = new PhotoCatalogBrowser("https://photos.example.com", request);

    await expect(browser.loadMonth(index, period)).rejects.toThrow("offline");
    await expect(browser.loadMonth(index, period)).resolves.toEqual(month);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("keys in-flight requests by immutable month path", async () => {
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
    const nextPeriod = {
      ...period,
      path: "catalog/months/2026-04.ffffffffffffffffffffffff.json",
    };
    const nextIndex = { ...index, periods: [nextPeriod] };

    const stale = browser.loadMonth(index, period);
    await expect(browser.loadMonth(nextIndex, nextPeriod)).resolves.toEqual(month);
    resolveFirst?.(month);
    await stale;
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not reuse an aborted request in a new catalog session", async () => {
    const request = vi.fn<PhotoCatalogRequest>((_url, { signal }) => {
      if (signal?.aborted) {
        return Promise.reject(new DOMException("aborted", "AbortError"));
      }
      return new Promise((resolve, reject) => {
        const complete = () => resolve(month);
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        });
        setTimeout(complete, 0);
      });
    });
    const browser = new PhotoCatalogBrowser("https://photos.example.com", request);
    const oldSession = new AbortController();
    const newSession = new AbortController();

    const stale = browser.loadMonth(index, period, oldSession.signal);
    oldSession.abort();
    const current = browser.loadMonth(index, period, newSession.signal);

    await expect(stale).rejects.toThrow("aborted");
    await expect(current).resolves.toEqual(month);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("loads only the month selected by the authoritative locator", async () => {
    const loadMonth = vi.fn(async () => month);
    await expect(resolveCatalogPhoto(index, photoId, loadMonth)).resolves.toEqual(month.photos[0]);
    expect(loadMonth).toHaveBeenCalledTimes(1);

    loadMonth.mockClear();
    await expect(
      resolveCatalogPhoto(index, "ffffffffffffffffffffffffffffffff", loadMonth),
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
