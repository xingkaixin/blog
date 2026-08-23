import { describe, expect, it, vi } from "vitest";
import { verifyPublishedPhotoCatalog } from "./verify-photo-catalog";

const catalog = {
  schemaVersion: 3,
  generatedAt: "2026-07-30T12:00:00.000Z",
  albums: [],
  periods: [],
  photoMonths: {},
};

function period(month: string, photoId: string) {
  return {
    month,
    count: 1,
    albumCounts: {},
    path: `catalog/months/${month}.0123456789abcdef01234567.json`,
    photoId,
  };
}

function catalogPeriod(value: ReturnType<typeof period>) {
  const { photoId: _, ...result } = value;
  return result;
}

function shard(month: string, photoId: string) {
  return {
    schemaVersion: 1,
    month,
    photos: [
      {
        id: photoId,
        capturedAt: `${month}-20T12:00:00.000+08:00`,
        width: 1200,
        height: 800,
        albumIds: [],
        placeholderColor: "#abcdef",
      },
    ],
  };
}

describe("photo catalog deployment", () => {
  it("accepts the current published schema", async () => {
    const load = vi.fn(async () => catalog);

    await expect(verifyPublishedPhotoCatalog("https://photos.example.com", load)).resolves.toEqual(
      catalog,
    );
    expect(load).toHaveBeenCalledWith("https://photos.example.com/catalog/index.json");
  });

  it("blocks deployment until a compatible legacy catalog is migrated", async () => {
    await expect(
      verifyPublishedPhotoCatalog("https://photos.example.com", async () => ({
        ...catalog,
        schemaVersion: 1,
        retiredObjects: [],
        retiredArtifacts: [],
      })),
    ).rejects.toThrow("photos:migrate");
  });

  it("blocks deployment when the eager locator outgrows its transfer budget", async () => {
    const photoMonths = Object.fromEntries(
      Array.from({ length: 6_000 }, (_, index) => [
        index.toString(16).padStart(32, "0"),
        "2026-08",
      ]),
    );

    await expect(
      verifyPublishedPhotoCatalog("https://photos.example.com", async () => ({
        ...catalog,
        periods: [
          {
            month: "2026-08",
            count: 6_000,
            albumCounts: {},
            path: "catalog/months/2026-08.0123456789abcdef01234567.json",
          },
        ],
        photoMonths,
      })),
    ).rejects.toThrow("拆分照片定位表");
  });

  it("validates every month referenced by the published catalog", async () => {
    const january = period("2026-01", "1".padStart(32, "0"));
    const february = period("2026-02", "2".padStart(32, "0"));
    const published = {
      ...catalog,
      periods: [february, january].map(catalogPeriod),
      photoMonths: {
        [january.photoId]: january.month,
        [february.photoId]: february.month,
      },
    };
    const load = vi.fn(async (url: string) => {
      if (url.endsWith("catalog/index.json")) {
        return published;
      }
      if (url.endsWith(february.path)) {
        return shard(february.month, february.photoId);
      }
      return shard(january.month, january.photoId);
    });

    await expect(verifyPublishedPhotoCatalog("https://photos.example.com", load)).resolves.toEqual(
      published,
    );
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("rejects a month that disagrees with the published catalog", async () => {
    const january = period("2026-01", "1".padStart(32, "0"));
    const published = {
      ...catalog,
      periods: [catalogPeriod(january)],
      photoMonths: { [january.photoId]: january.month },
    };

    await expect(
      verifyPublishedPhotoCatalog("https://photos.example.com", async (url) =>
        url.endsWith("catalog/index.json")
          ? published
          : { ...shard(january.month, january.photoId), photos: [] },
      ),
    ).rejects.toThrow(january.path);
  });

  it("limits concurrent month reads", async () => {
    const periods = Array.from({ length: 20 }, (_, index) => {
      const month = new Date(Date.UTC(2025, index, 1)).toISOString().slice(0, 7);
      const photoId = index.toString(16).padStart(32, "0");
      return period(month, photoId);
    });
    const published = {
      ...catalog,
      periods: periods.map(catalogPeriod).toReversed(),
      photoMonths: Object.fromEntries(periods.map(({ photoId, month }) => [photoId, month])),
    };
    let active = 0;
    let maximumActive = 0;
    const load = async (url: string) => {
      if (url.endsWith("catalog/index.json")) {
        return published;
      }
      const target = periods.find(({ path }) => url.endsWith(path))!;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      return shard(target.month, target.photoId);
    };

    await verifyPublishedPhotoCatalog("https://photos.example.com", load);
    expect(maximumActive).toBe(8);
  });
});
