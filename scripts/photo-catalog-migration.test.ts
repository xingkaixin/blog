import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PHOTO_CATALOG_INDEX_KEY, parsePhotoCatalogIndex } from "../src/lib/photo-catalog";
import { PHOTO_CATALOG_CONTROL_KEY, parsePhotoCatalogControl } from "./lib/photo-catalog-control";
import { migratePhotoCatalog } from "./lib/photo-catalog-store";
import { FilePhotoObjectStore } from "./lib/photo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("photo catalog migration", () => {
  it("migrates a deployed v1 catalog once", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "photo-catalog-migration-"));
    temporaryDirectories.push(root);
    const catalogDirectory = path.join(root, "catalog");
    await fs.mkdir(catalogDirectory, { recursive: true });
    await fs.writeFile(
      path.join(root, PHOTO_CATALOG_INDEX_KEY),
      JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-30T12:00:00.000Z",
        albums: [],
        periods: [],
        photoMonths: {},
        retiredObjects: [],
        retiredArtifacts: [],
      }),
    );
    const store = new FilePhotoObjectStore(root);

    await expect(migratePhotoCatalog(store)).resolves.toBe(true);
    const control = parsePhotoCatalogControl(
      JSON.parse((await store.getText(PHOTO_CATALOG_CONTROL_KEY))!.text),
    );
    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );

    expect(control.schemaVersion).toBe(4);
    expect(index.schemaVersion).toBe(3);
    await expect(migratePhotoCatalog(store)).resolves.toBe(false);
  });
});
