import { describe, expect, it, vi } from "vitest";
import type { PhotoCatalogIndex, PhotoMonthCatalog } from "@/lib/photo-catalog";
import {
  PhotoCatalogBrowser,
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
    await expect(resolveCatalogPhoto(index, photoId, {}, loadMonth)).resolves.toEqual(
      month.photos[0],
    );
    expect(loadMonth).toHaveBeenCalledTimes(1);

    loadMonth.mockClear();
    await expect(
      resolveCatalogPhoto(index, "ffffffffffffffffffffffffffffffff", {}, loadMonth),
    ).resolves.toBeNull();
    expect(loadMonth).not.toHaveBeenCalled();
  });

  it("does not scan unrelated loaded months", async () => {
    const unrelatedMonth: PhotoMonthCatalog = {
      schemaVersion: 1,
      month: "2026-03",
      get photos(): PhotoMonthCatalog["photos"] {
        throw new Error("unrelated month was scanned");
      },
    };
    const loadMonth = vi.fn(async () => {
      throw new Error("the target month is already loaded");
    });

    await expect(
      resolveCatalogPhoto(
        index,
        photoId,
        { "2026-03": unrelatedMonth, [month.month]: month },
        loadMonth,
      ),
    ).resolves.toEqual(month.photos[0]);
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
