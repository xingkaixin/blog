import { describe, expect, it, vi } from "vitest";
import { verifyPhotoControlPrivacy, verifyPublishedPhotoCatalog } from "./verify-photo-catalog";

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
  it("blocks public control documents and uncertain privacy checks", async () => {
    for (const status of [200, 302, 500]) {
      await expect(
        verifyPhotoControlPrivacy(
          "https://photos.example.com",
          async () => new Response(null, { status }),
        ),
      ).rejects.toThrow(`当前响应 ${status}`);
    }
    for (const status of [403, 404]) {
      await expect(
        verifyPhotoControlPrivacy(
          "https://photos.example.com",
          async () => new Response(null, { status }),
        ),
      ).resolves.toBeUndefined();
    }
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
});
