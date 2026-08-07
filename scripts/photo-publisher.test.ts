import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PHOTO_CATALOG_INDEX_KEY,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  type PhotoVariantWidth,
} from "../src/lib/photo-catalog";
import { deletePhotos, publishPhotos } from "./lib/photo-publisher";
import { hashPhotoFile, type ProcessedPhoto } from "./lib/photo-source";
import type { PhotoObjectBody, PhotoObjectStore, PutPhotoObjectOptions } from "./lib/photo-store";

class MemoryPhotoStore implements PhotoObjectStore {
  readonly objects = new Map<string, PhotoObjectBody>();
  readonly writes: string[] = [];
  readonly deletes: string[] = [];

  async getText(key: string): Promise<string | null> {
    const value = this.objects.get(key);
    if (value === undefined) {
      return null;
    }
    return typeof value === "string" ? value : new TextDecoder().decode(value);
  }

  async put(key: string, body: PhotoObjectBody, _options: PutPhotoObjectOptions): Promise<void> {
    this.objects.set(key, body);
    this.writes.push(key);
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
    this.deletes.push(key);
  }
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

async function createSourceFile(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "photo-publisher-test-"));
  temporaryDirectories.push(directory);
  const file = path.join(directory, "source.jpg");
  await fs.writeFile(file, "stable photo bytes");
  return file;
}

function processedPhoto(id: string): ProcessedPhoto {
  return {
    id,
    capturedAt: "2026-04-25T21:12:30.244+07:00",
    width: 3024,
    height: 4032,
    placeholderColor: "#4f5f6a",
    variants: new Map<PhotoVariantWidth, Uint8Array>([
      [480, new Uint8Array([4, 8, 0])],
      [960, new Uint8Array([9, 6, 0])],
      [2048, new Uint8Array([2, 0, 4, 8])],
    ]),
  };
}

describe("photo publisher", () => {
  it("publishes immutable assets and a content-addressed month before the index", async () => {
    const file = await createSourceFile();
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();

    const result = await publishPhotos({
      files: [file],
      store,
      album: { id: "japan-2026", title: "日本旅行" },
      processPhoto: vi.fn(async () => processedPhoto(id)),
      now: () => new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(result).toEqual({
      discovered: 1,
      published: 1,
      reused: 0,
      updatedPeriods: 1,
      catalogChanged: true,
    });
    expect(store.writes.at(-1)).toBe(PHOTO_CATALOG_INDEX_KEY);
    expect(store.objects.has(`media/${id}/480.webp`)).toBe(true);

    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!),
    );
    expect(index.albums).toEqual([{ id: "japan-2026", title: "日本旅行" }]);
    expect(index.photoMonths[id]).toBe("2026-04");
    expect(index.periods[0]?.path).toMatch(/^catalog\/months\/2026-04\.[a-f0-9]{24}\.json$/);

    const month = parsePhotoMonthCatalog(JSON.parse((await store.getText(index.periods[0].path))!));
    expect(month.photos[0]?.albumIds).toEqual(["japan-2026"]);
  });

  it("is idempotent and can add an existing photo to another logical album", async () => {
    const file = await createSourceFile();
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();

    await publishPhotos({
      files: [file],
      store,
      album: { id: "japan-2026", title: "日本旅行" },
      processPhoto: async () => processedPhoto(id),
      now: () => new Date("2026-07-30T12:00:00.000Z"),
    });
    const initialWriteCount = store.writes.length;
    const shouldNotProcess = vi.fn(async () => {
      throw new Error("existing photo should not be decoded");
    });

    const unchanged = await publishPhotos({
      files: [file],
      store,
      album: { id: "japan-2026" },
      processPhoto: shouldNotProcess,
    });

    expect(unchanged.catalogChanged).toBe(false);
    expect(store.writes).toHaveLength(initialWriteCount);
    expect(shouldNotProcess).not.toHaveBeenCalled();

    const updated = await publishPhotos({
      files: [file],
      store,
      album: { id: "favorites", title: "喜欢" },
      processPhoto: shouldNotProcess,
      now: () => new Date("2026-07-30T13:00:00.000Z"),
    });

    expect(updated).toMatchObject({
      published: 0,
      reused: 1,
      updatedPeriods: 1,
      catalogChanged: true,
    });
    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!),
    );
    const month = parsePhotoMonthCatalog(JSON.parse((await store.getText(index.periods[0].path))!));
    expect(month.photos[0]?.albumIds).toEqual(["favorites", "japan-2026"]);
  });

  it("updates the catalog before deleting a photo's assets", async () => {
    const file = await createSourceFile();
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();

    await publishPhotos({
      files: [file],
      store,
      album: { id: "smoke-test", title: "测试" },
      processPhoto: async () => processedPhoto(id),
    });
    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!),
    );
    const oldPeriodPath = index.periods[0].path;

    const result = await deletePhotos({ photoIds: [id], store });

    expect(result).toEqual({ deleted: 1, removedObjects: 4, updatedPeriods: 1 });
    expect(
      parsePhotoCatalogIndex(JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!)),
    ).toEqual(expect.objectContaining({ albums: [], periods: [] }));
    expect(store.objects.has(oldPeriodPath)).toBe(false);
    expect(store.objects.has(`media/${id}/480.webp`)).toBe(false);
    expect(store.deletes).toContain(oldPeriodPath);
  });
});
