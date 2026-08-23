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
});
