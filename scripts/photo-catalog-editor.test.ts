import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PHOTO_CATALOG_INDEX_KEY,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
} from "../src/lib/photo-catalog";
import { PHOTO_CATALOG_CONTROL_KEY, parsePhotoCatalogControl } from "./lib/photo-catalog-control";
import { PhotoCatalogEditor } from "./lib/photo-catalog-store";
import { FilePhotoObjectStore } from "./lib/photo-store";

const temporaryDirectories: string[] = [];
const photoId = "a".repeat(32);
const month = "2026-08";
const periodPath = `catalog/months/${month}.aaaaaaaaaaaaaaaaaaaaaaaa.json`;
const generatedAt = "2026-08-23T08:00:00.000Z";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("photo catalog editor", () => {
  it("reports photos outside the catalog as absent", async () => {
    const catalog = await PhotoCatalogEditor.load(await catalogStore());
    const absentPhotoId = "b".repeat(32);

    await expect(catalog.inspectPhotos([photoId, absentPhotoId])).resolves.toEqual(
      new Map([
        [photoId, "published"],
        [absentPhotoId, "absent"],
      ]),
    );
  });

  it("loads the owning month before updating an album", async () => {
    const store = await catalogStore();
    const catalog = await PhotoCatalogEditor.load(store);

    await expect(catalog.addPhotoToAlbum(photoId, "trip")).resolves.toBe(true);
    await expect(catalog.addPhotoToAlbum(photoId, "trip")).resolves.toBe(false);
    await expect(catalog.commit(new Date("2026-08-23T09:00:00.000Z"))).resolves.toEqual({
      catalogChanged: true,
      updatedPeriods: 1,
    });

    const control = parsePhotoCatalogControl(
      JSON.parse((await store.getText(PHOTO_CATALOG_CONTROL_KEY))!.text),
    );
    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    const updatedMonth = parsePhotoMonthCatalog(
      JSON.parse((await store.getText(control.periods[0].path))!.text),
    );
    expect(updatedMonth.photos[0].albumIds).toEqual(["trip"]);
    expect(index).toEqual({
      schemaVersion: 3,
      generatedAt: control.generatedAt,
      albums: control.albums,
      periods: control.periods,
      photoMonths: control.photoMonths,
    });
  });
});

async function catalogStore(): Promise<FilePhotoObjectStore> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "photo-catalog-editor-"));
  temporaryDirectories.push(directory);
  const store = new FilePhotoObjectStore(directory);
  const contents = {
    generatedAt,
    albums: [{ id: "trip", title: "旅行" }],
    periods: [{ month, count: 1, albumCounts: {}, path: periodPath }],
    photoMonths: { [photoId]: month },
  };
  await store.put(
    PHOTO_CATALOG_CONTROL_KEY,
    JSON.stringify({
      schemaVersion: 1,
      ...contents,
      retiredObjects: [],
      retiredArtifacts: [],
    }),
    { contentType: "application/json", cacheControl: "no-store" },
  );
  await store.put(PHOTO_CATALOG_INDEX_KEY, JSON.stringify({ schemaVersion: 3, ...contents }), {
    contentType: "application/json",
    cacheControl: "no-cache",
  });
  await store.put(
    periodPath,
    JSON.stringify({
      schemaVersion: 1,
      month,
      photos: [
        {
          id: photoId,
          capturedAt: "2026-08-20T12:00:00.000+08:00",
          width: 1200,
          height: 800,
          albumIds: [],
          placeholderColor: "#abcdef",
        },
      ],
    }),
    { contentType: "application/json", cacheControl: "immutable" },
  );
  return store;
}
