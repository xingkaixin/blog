import { describe, expect, it, vi } from "vitest";
import { verifyPublishedPhotoCatalog } from "./verify-photo-catalog";

const catalog = {
  schemaVersion: 3,
  generatedAt: "2026-07-30T12:00:00.000Z",
  albums: [],
  periods: [],
  photoMonths: {},
};

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
});
