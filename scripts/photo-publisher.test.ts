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
import {
  PhotoStoreConflictError,
  type PhotoObjectBody,
  type PhotoObjectStore,
  type PhotoTextObject,
  type PutPhotoObjectOptions,
} from "./lib/photo-store";

class MemoryPhotoStore implements PhotoObjectStore {
  readonly objects = new Map<string, PhotoObjectBody>();
  readonly versions = new Map<string, string>();
  readonly writes: string[] = [];
  readonly deletes: string[] = [];
  nextVersion = 0;

  async getText(key: string): Promise<PhotoTextObject | null> {
    const value = this.objects.get(key);
    if (value === undefined) {
      return null;
    }
    return {
      text: typeof value === "string" ? value : new TextDecoder().decode(value),
      version: this.versions.get(key)!,
    };
  }

  async put(key: string, body: PhotoObjectBody, options: PutPhotoObjectOptions): Promise<string> {
    const currentVersion = this.versions.get(key) ?? null;
    if (options.expectedVersion !== undefined && options.expectedVersion !== currentVersion) {
      throw new PhotoStoreConflictError(key);
    }
    const version = `v${(this.nextVersion += 1)}`;
    this.objects.set(key, body);
    this.versions.set(key, version);
    this.writes.push(key);
    return version;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
    this.versions.delete(key);
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

async function createSourceFile(contents = "stable photo bytes"): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "photo-publisher-test-"));
  temporaryDirectories.push(directory);
  const file = path.join(directory, "source.jpg");
  await fs.writeFile(file, contents);
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
  it("preserves both updates when two publishers start from the same catalog", async () => {
    const firstFile = await createSourceFile("first photo bytes");
    const secondFile = await createSourceFile("second photo bytes");
    const firstId = await hashPhotoFile(firstFile);
    const secondId = await hashPhotoFile(secondFile);
    const store = new MemoryPhotoStore();
    let initialReads = 0;
    let releaseInitialReads: (() => void) | undefined;
    const initialReadsReady = new Promise<void>((resolve) => {
      releaseInitialReads = resolve;
    });
    const originalGetText = store.getText.bind(store);
    store.getText = async (key) => {
      if (key === PHOTO_CATALOG_INDEX_KEY && initialReads < 2) {
        initialReads += 1;
        if (initialReads === 2) {
          releaseInitialReads?.();
        }
        await initialReadsReady;
      }
      return originalGetText(key);
    };

    await Promise.all([
      publishPhotos({
        files: [firstFile],
        store,
        processPhoto: async () => processedPhoto(firstId),
      }),
      publishPhotos({
        files: [secondFile],
        store,
        processPhoto: async () => processedPhoto(secondId),
      }),
    ]);

    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.photoMonths).toEqual({
      [firstId]: "2026-04",
      [secondId]: "2026-04",
    });
    const month = parsePhotoMonthCatalog(
      JSON.parse((await store.getText(index.periods[0].path))!.text),
    );
    expect(month.photos.map((photo) => photo.id).toSorted()).toEqual(
      [firstId, secondId].toSorted(),
    );
  });

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
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.albums).toEqual([{ id: "japan-2026", title: "日本旅行" }]);
    expect(index.photoMonths[id]).toBe("2026-04");
    expect(index.periods[0]?.path).toMatch(/^catalog\/months\/2026-04\.[a-f0-9]{24}\.json$/);

    const month = parsePhotoMonthCatalog(
      JSON.parse((await store.getText(index.periods[0].path))!.text),
    );
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
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    const month = parsePhotoMonthCatalog(
      JSON.parse((await store.getText(index.periods[0].path))!.text),
    );
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
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    const oldPeriodPath = index.periods[0].path;

    const result = await deletePhotos({ photoIds: [id], store });

    expect(result).toEqual({ deleted: 1, removedObjects: 4, updatedPeriods: 1 });
    expect(
      parsePhotoCatalogIndex(JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text)),
    ).toEqual(expect.objectContaining({ albums: [], periods: [] }));
    expect(store.objects.has(oldPeriodPath)).toBe(false);
    expect(store.objects.has(`media/${id}/480.webp`)).toBe(false);
    expect(store.deletes).toContain(oldPeriodPath);
  });
});
