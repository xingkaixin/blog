import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPhotoArtifactKey, photoMediaObjectKey } from "../../src/lib/photo-artifact";
import {
  PHOTO_CATALOG_INDEX_KEY,
  PHOTO_VARIANT_WIDTHS,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  type PhotoVariantWidth,
} from "../../src/lib/photo-catalog";
import { PHOTO_CATALOG_CONTROL_KEY, parsePhotoCatalogControl } from "./photo-catalog-control";
import { migratePhotoCatalog } from "./photo-catalog-store";
import { collectPhotoGarbage } from "./photo-garbage-collector";
import { publishPhotos } from "./photo-publisher";
import { retirePhotos } from "./photo-retirement";
import { hashPhotoFile, type ProcessedPhoto } from "./photo-source";
import {
  PhotoStoreConflictError,
  type PhotoObjectBody,
  type PhotoObjectStore,
  type PhotoTextObject,
  type PutPhotoObjectOptions,
} from "./photo-store";

class MemoryPhotoStore implements PhotoObjectStore {
  readonly objects = new Map<string, PhotoObjectBody>();
  readonly versions = new Map<string, string>();
  readonly writes: string[] = [];
  readonly deletes: string[] = [];
  readonly deleteFailures = new Map<string, number>();
  nextVersion = 0;
  readonly modified = new Map<string, Date>();
  async *list(prefix: string) {
    for (const key of this.objects.keys()) {
      if (key.startsWith(prefix)) {
        yield { key, lastModified: this.modified.get(key) ?? new Date(0) };
      }
    }
  }

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
    if (options.expectedVersion !== currentVersion) {
      throw new PhotoStoreConflictError(key);
    }
    const version = `v${(this.nextVersion += 1)}`;
    this.objects.set(key, body);
    this.versions.set(key, version);
    this.writes.push(key);
    return version;
  }

  async delete(key: string): Promise<void> {
    const failures = this.deleteFailures.get(key) ?? 0;
    if (failures > 0) {
      this.deleteFailures.set(key, failures - 1);
      throw new Error(`temporary delete failure: ${key}`);
    }
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

async function readControl(store: PhotoObjectStore) {
  return parsePhotoCatalogControl(
    JSON.parse((await store.getText(PHOTO_CATALOG_CONTROL_KEY))!.text),
  );
}

async function publishedObjectKeys(store: PhotoObjectStore): Promise<string[]> {
  const index = parsePhotoCatalogIndex(
    JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
  );
  const keys: string[] = [];
  for (const period of index.periods) {
    keys.push(period.path);
    const month = parsePhotoMonthCatalog(JSON.parse((await store.getText(period.path))!.text));
    for (const photo of month.photos) {
      keys.push(
        ...PHOTO_VARIANT_WIDTHS.map((width) =>
          photoMediaObjectKey(photo.id, width, photo.mediaRevision),
        ),
      );
    }
  }
  return keys;
}

function processedPhoto(id: string, capturedAt = "2026-04-25T21:12:30.244+07:00"): ProcessedPhoto {
  return {
    id,
    capturedAt,
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
  it("discovers artifacts left behind by a terminated process", async () => {
    const file = await createSourceFile("orphan scan");
    const store = new MemoryPhotoStore();
    await publishPhotos({
      files: [file],
      store,
      processPhoto: async (_, id) => processedPhoto(id),
    });
    const orphan = `media/${"a".repeat(32)}/${"b".repeat(24)}/960.webp`;
    const shard = `catalog/months/2020-01.${"c".repeat(24)}.json`;
    const fresh = `media/${"d".repeat(32)}/${"e".repeat(24)}/480.webp`;
    const now = new Date("2026-08-28T12:00:00Z");
    for (const key of [orphan, shard, fresh, "media/unknown.txt"]) {
      store.objects.set(key, new Uint8Array([1]));
    }
    store.modified.set(fresh, new Date(now.getTime() - 2 * 60 * 60 * 1000));
    const liveKeys = await publishedObjectKeys(store);
    const publicBefore = store.objects.get(PHOTO_CATALOG_INDEX_KEY);
    await collectPhotoGarbage({ store, now: () => now });
    expect((await readControl(store)).retiredArtifacts).toEqual([]);
    await collectPhotoGarbage({ store, scan: true, now: () => now });
    const retired = (await readControl(store)).retiredArtifacts.flatMap(
      (entry) => entry.objectKeys,
    );
    expect(retired.toSorted()).toEqual([orphan, shard].toSorted());
    expect(store.objects.get(PHOTO_CATALOG_INDEX_KEY)).toBe(publicBefore);
    expect(store.deletes).toEqual([]);
    await collectPhotoGarbage({ store, now: () => new Date(now.getTime() + 25 * 60 * 60 * 1000) });
    expect(store.deletes.toSorted()).toEqual([orphan, shard].toSorted());
    expect([...liveKeys, fresh, "media/unknown.txt"].every((key) => store.objects.has(key))).toBe(
      true,
    );
  });
  it("rejects source changes between identification and processing", async () => {
    const file = await createSourceFile("identified source");
    const store = new MemoryPhotoStore();
    const get = store.getText.bind(store);
    store.getText = async (key) => {
      await fs.writeFile(file, "changed source");
      return get(key);
    };
    const processPhoto = vi.fn();
    await expect(publishPhotos({ files: [file], store, processPhoto })).rejects.toThrow(
      "源文件在识别后发生变化",
    );
    expect(processPhoto).not.toHaveBeenCalled();
    expect(store.writes).toEqual([]);
  });

  it("can republish a deleted photo before its old media is collected", async () => {
    const file = await createSourceFile("republish immediately");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    const options = { files: [file], store, processPhoto: async () => processedPhoto(id) };
    await publishPhotos(options);
    const oldKeys = await publishedObjectKeys(store);
    await retirePhotos({ photoIds: [id], store });
    await publishPhotos(options);
    const newKeys = await publishedObjectKeys(store);
    expect(newKeys.some((key) => oldKeys.includes(key))).toBe(false);
    await collectPhotoGarbage({ store, now: () => new Date(Date.now() + 26 * 60 * 60 * 1000) });
    expect(oldKeys.some((key) => store.objects.has(key))).toBe(false);
    expect(newKeys.every((key) => store.objects.has(key))).toBe(true);
  });
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
    const referencedKeys = new Set(await publishedObjectKeys(store));
    const unreferencedKeys = [...store.objects.keys()].filter(
      (key) => isPhotoArtifactKey(key) && !referencedKeys.has(key),
    );
    const control = await readControl(store);
    expect(control.retiredArtifacts.flatMap((entry) => entry.objectKeys).toSorted()).toEqual(
      unreferencedKeys.toSorted(),
    );
  });

  it("preserves publicly referenced objects until explicit repair and cache expiry", async () => {
    const file = await createSourceFile("retirement while the public index is unavailable");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    let now = new Date("2026-08-01T12:00:00.000Z");
    await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
      now: () => now,
    });
    const keys = await publishedObjectKeys(store);
    const originalPut = store.put.bind(store);
    let unavailable = true;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_INDEX_KEY && unavailable) {
        throw new Error("public index unavailable");
      }
      return originalPut(key, body, options);
    };

    await expect(retirePhotos({ photoIds: [id], store, now: () => now })).rejects.toThrow(
      "public index unavailable",
    );
    now = new Date("2026-08-02T14:00:00.000Z");
    const writes = store.writes.length;
    await expect(collectPhotoGarbage({ store, now: () => now })).resolves.toMatchObject({
      removedObjects: 0,
      projectionOutOfSync: true,
    });
    expect(store.writes).toHaveLength(writes);
    expect(keys.filter((key) => !store.objects.has(key))).toEqual([]);

    unavailable = false;
    await migratePhotoCatalog(store);
    await collectPhotoGarbage({ store, now: () => now });
    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.photoMonths[id]).toBeUndefined();
    expect(store.deletes).toEqual([]);
    now = new Date("2026-08-03T14:59:59.000Z");
    expect(await collectPhotoGarbage({ store, now: () => now })).toMatchObject({
      removedObjects: 0,
    });
    now = new Date("2026-08-03T15:00:00.000Z");
    expect(await collectPhotoGarbage({ store, now: () => now })).toMatchObject({
      removedObjects: keys.length,
      pendingArtifacts: 0,
    });
  });

  it("publishes immutable assets and a versioned month before the index", async () => {
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
    for (const key of await publishedObjectKeys(store)) {
      expect(store.objects.has(key), key).toBe(true);
    }

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
    expect(month.photos[0]?.mediaRevision).toMatch(/^[a-f0-9]{24}$/);
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

  it("requires explicit migration of a combined catalog before publication", async () => {
    const file = await createSourceFile();
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();

    await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
    });
    const indexObject = await store.getText(PHOTO_CATALOG_INDEX_KEY);
    const control = await readControl(store);
    store.objects.set(
      PHOTO_CATALOG_INDEX_KEY,
      JSON.stringify({
        ...JSON.parse(indexObject!.text),
        schemaVersion: 2,
        retiredObjects: [],
        retiredArtifacts: control.retiredArtifacts,
      }),
    );
    store.objects.delete(PHOTO_CATALOG_CONTROL_KEY);
    store.versions.delete(PHOTO_CATALOG_CONTROL_KEY);
    store.writes.length = 0;

    await expect(
      publishPhotos({ files: [file], store, processPhoto: async () => processedPhoto(id) }),
    ).rejects.toThrow("photos:migrate");
    expect(store.writes).toEqual([]);
    await expect(migratePhotoCatalog(store)).resolves.toBe(true);
    const result = await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => {
        throw new Error("existing photo should not be processed");
      },
    });

    expect(result.catalogChanged).toBe(false);
    expect(store.writes).toEqual([PHOTO_CATALOG_CONTROL_KEY, PHOTO_CATALOG_INDEX_KEY]);
    const migrated = JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text);
    expect(migrated).toMatchObject({ schemaVersion: 3, photoMonths: { [id]: "2026-04" } });
    expect(migrated).not.toHaveProperty("retiredObjects");
    expect(migrated).not.toHaveProperty("retiredArtifacts");
  });

  it("keeps retired objects through the cache grace period and resumes partial cleanup", async () => {
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
    const mediaKeys = await publishedObjectKeys(store);
    const thumbnailKey = mediaKeys.find((key) => key.endsWith("/480.webp"))!;
    const displayKey = mediaKeys.find((key) => key.endsWith("/960.webp"))!;

    const retiredAt = new Date("2026-08-07T12:00:00.000Z");
    const result = await retirePhotos({
      photoIds: [id],
      store,
      now: () => retiredAt,
    });

    expect(result).toEqual({
      retired: 1,
      updatedPeriods: 1,
    });
    const updatedIndex = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    const publicIndexBody = store.objects.get(PHOTO_CATALOG_INDEX_KEY);
    const publicIndexVersion = store.versions.get(PHOTO_CATALOG_INDEX_KEY);
    let control = await readControl(store);
    expect(updatedIndex).toEqual(expect.objectContaining({ albums: [], periods: [] }));
    expect(control.retiredArtifacts).toHaveLength(2);
    expect(store.objects.has(oldPeriodPath)).toBe(true);
    expect(store.objects.has(thumbnailKey)).toBe(true);

    expect(
      await collectPhotoGarbage({
        store,
        now: () => new Date("2026-08-08T12:00:00.000Z"),
      }),
    ).toEqual({
      removedObjects: 0,
      failedObjects: 0,
      pendingArtifacts: 2,
      failures: [],
      projectionOutOfSync: false,
    });

    store.deleteFailures.set(displayKey, 1);
    expect(
      await collectPhotoGarbage({
        store,
        now: () => new Date("2026-08-08T14:00:00.000Z"),
      }),
    ).toEqual({
      removedObjects: 3,
      failedObjects: 1,
      pendingArtifacts: 1,
      failures: [
        {
          objectKey: displayKey,
          message: `temporary delete failure: ${displayKey}`,
        },
      ],
      projectionOutOfSync: false,
    });
    expect(store.objects.has(displayKey)).toBe(true);

    await collectPhotoGarbage({ store, now: () => new Date("2026-08-08T14:01:00.000Z") });
    control = await readControl(store);
    expect(control.retiredArtifacts).toEqual([]);
    expect(store.objects.get(PHOTO_CATALOG_INDEX_KEY)).toBe(publicIndexBody);
    expect(store.versions.get(PHOTO_CATALOG_INDEX_KEY)).toBe(publicIndexVersion);
    expect(store.objects.has(oldPeriodPath)).toBe(false);
    expect(store.objects.has(displayKey)).toBe(false);
  });

  it("can restore month contents while their previous path is being collected", async () => {
    const firstFile = await createSourceFile("first live photo");
    const secondFile = await createSourceFile("temporary second photo");
    const firstId = await hashPhotoFile(firstFile);
    const secondId = await hashPhotoFile(secondFile);
    const store = new MemoryPhotoStore();

    await publishPhotos({
      files: [firstFile],
      store,
      processPhoto: async () => processedPhoto(firstId),
      now: () => new Date("2026-08-01T12:00:00.000Z"),
    });
    const firstIndex = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    const revivedPath = firstIndex.periods[0].path;

    await publishPhotos({
      files: [secondFile],
      store,
      processPhoto: async () => processedPhoto(secondId),
      now: () => new Date("2026-08-02T12:00:00.000Z"),
    });

    const deletionStarted = deferred<void>();
    const releaseDeletion = deferred<void>();
    const originalDelete = store.delete.bind(store);
    store.delete = async (key) => {
      if (key === revivedPath) {
        deletionStarted.resolve(undefined);
        await releaseDeletion.promise;
      }
      return originalDelete(key);
    };

    const garbageCollection = collectPhotoGarbage({
      store,
      now: () => new Date("2026-08-03T14:00:00.000Z"),
    });
    await deletionStarted.promise;
    await expect(
      retirePhotos({
        photoIds: [secondId],
        store,
        now: () => new Date("2026-08-02T13:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ retired: 1 });
    releaseDeletion.resolve(undefined);
    await garbageCollection;

    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.periods[0]?.path).not.toBe(revivedPath);
    expect(store.objects.has(revivedPath)).toBe(false);
    for (const key of await publishedObjectKeys(store)) {
      expect(store.objects.has(key), key).toBe(true);
    }
  });

  it("refuses to collect a media revision still referenced by a live month", async () => {
    const file = await createSourceFile("live media must not be collected");
    const store = new MemoryPhotoStore();
    await publishPhotos({
      files: [file],
      store,
      processPhoto: async (_, id) => processedPhoto(id),
    });
    const keys = await publishedObjectKeys(store);
    const mediaKey = keys.find((key) => key.startsWith("media/"))!;
    const control = await readControl(store);
    control.retiredArtifacts.push({
      retirementId: "a".repeat(24),
      objectKeys: [mediaKey],
      deleteAfter: "2026-08-01T00:00:00.000Z",
    });
    await store.put(PHOTO_CATALOG_CONTROL_KEY, JSON.stringify(control), {
      contentType: "application/json",
      cacheControl: "no-store",
      expectedVersion: store.versions.get(PHOTO_CATALOG_CONTROL_KEY)!,
    });

    await expect(collectPhotoGarbage({ store })).rejects.toThrow("仍被主 Catalog 引用");
    expect(store.deletes).toEqual([]);
    for (const key of keys) {
      expect(store.objects.has(key), key).toBe(true);
    }
  });

  it("recreates failed publish artifacts collected during a later commit retry", async () => {
    const file = await createSourceFile("failed catalog commit");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    const originalPut = store.put.bind(store);
    const processPhoto = vi.fn(async (_source: string) => processedPhoto(id));
    const progress: string[] = [];
    let conflictsRemaining = 5;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_CONTROL_KEY && conflictsRemaining > 0) {
        conflictsRemaining -= 1;
        throw new PhotoStoreConflictError(key);
      }
      return originalPut(key, body, options);
    };

    await expect(
      publishPhotos({
        files: [file],
        store,
        processPhoto,
        onProgress: (event) => progress.push(event.type),
        now: () => new Date("2026-08-02T12:00:00.000Z"),
      }),
    ).rejects.toThrow(PhotoStoreConflictError);
    expect(processPhoto).toHaveBeenCalledTimes(1);
    expect(progress).toEqual(["processing"]);
    await expect(fs.access(path.dirname(processPhoto.mock.calls[0][0]))).rejects.toThrow();

    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.periods).toEqual([]);
    expect(index.photoMonths).toEqual({});
    const control = await readControl(store);
    expect(control.retiredArtifacts.flatMap((entry) => entry.objectKeys).toSorted()).toEqual(
      [...store.objects.keys()].filter(isPhotoArtifactKey).toSorted(),
    );

    let collectBeforeCommit = true;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_CONTROL_KEY && collectBeforeCommit) {
        collectBeforeCommit = false;
        await collectPhotoGarbage({
          store,
          now: () => new Date("2026-08-03T13:01:00.000Z"),
        });
      }
      return originalPut(key, body, options);
    };

    await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
      now: () => new Date("2026-08-03T12:59:00.000Z"),
    });
    const recoveredIndex = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(recoveredIndex.photoMonths[id]).toBe("2026-04");
    const referencedKeys = await publishedObjectKeys(store);
    await collectPhotoGarbage({ store, now: () => new Date("2026-08-05T12:00:00.000Z") });
    for (const key of referencedKeys) {
      expect(store.objects.has(key), key).toBe(true);
    }
    expect((await readControl(store)).retiredArtifacts).toEqual([]);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
