import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPhotoArtifactKey, photoMediaObjectKey } from "../src/lib/photo-artifact";
import {
  PHOTO_CATALOG_INDEX_KEY,
  PHOTO_VARIANT_WIDTHS,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  type PhotoVariantWidth,
} from "../src/lib/photo-catalog";
import { PHOTO_CATALOG_CONTROL_KEY, parsePhotoCatalogControl } from "./lib/photo-catalog-control";
import { migratePhotoCatalog } from "./lib/photo-catalog-store";
import { collectPhotoGarbage } from "./lib/photo-garbage-collector";
import { publishPhotos } from "./lib/photo-publisher";
import { retirePhotos } from "./lib/photo-retirement";
import { hashPhotoFile, type ProcessedPhoto } from "./lib/photo-source";
import {
  FilePhotoObjectStore,
  PhotoStoreConflictError,
  type PhotoObjectBody,
  type PhotoObjectStore,
  type PhotoTextObject,
  type PutPhotoObjectOptions,
} from "./lib/photo-store";

class MemoryPhotoStore implements PhotoObjectStore {
  readonly objects = new Map<string, PhotoObjectBody>();
  readonly versions = new Map<string, string>();
  readonly reads: string[] = [];
  readonly writes: string[] = [];
  readonly deletes: string[] = [];
  readonly deleteFailures = new Map<string, number>();
  nextVersion = 0;

  async getText(key: string): Promise<PhotoTextObject | null> {
    this.reads.push(key);
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

  it("disposes each source snapshot before catalog commit", async () => {
    const files = await Promise.all([
      createSourceFile("snapshot-a"),
      createSourceFile("snapshot-b"),
      createSourceFile("snapshot-c"),
    ]);
    const store = new MemoryPhotoStore();
    const sources: string[] = [];
    const put = store.put.bind(store);
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_CONTROL_KEY) {
        await Promise.all(sources.map((source) => expect(fs.access(source)).rejects.toThrow()));
      }
      return put(key, body, options);
    };
    await publishPhotos({
      files,
      store,
      processPhoto: async (source, id) => {
        sources.push(source);
        return processedPhoto(id);
      },
    });
    expect(sources).toHaveLength(3);
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
  it.each([1, 5])("tracks deletion shards across %i control conflicts", async (conflicts) => {
    const files = await Promise.all([createSourceFile("delete-a"), createSourceFile("delete-b")]);
    const ids = await Promise.all(files.map(hashPhotoFile));
    const store = new MemoryPhotoStore();
    await publishPhotos({ files, store, processPhoto: async (_file, id) => processedPhoto(id) });
    const put = store.put.bind(store);
    let remaining = conflicts;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_CONTROL_KEY && remaining > 0) {
        remaining -= 1;
        throw new PhotoStoreConflictError(key);
      }
      return put(key, body, options);
    };
    const result = retirePhotos({ photoIds: [ids[0]], store });
    if (conflicts === 5) {
      await expect(result).rejects.toThrow(PhotoStoreConflictError);
    } else {
      await result;
    }
    const control = await readControl(store);
    const accounted = new Set([
      ...(await publishedObjectKeys(store)),
      ...control.retiredArtifacts.flatMap((entry) => entry.objectKeys),
    ]);
    const orphaned = [...store.objects.keys()].filter(
      (key) => isPhotoArtifactKey(key) && !accounted.has(key),
    );
    expect(orphaned).toEqual([]);
  });

  it("processes once and reports publication only after control retries commit", async () => {
    const file = await createSourceFile("publish through control conflicts");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    const originalPut = store.put.bind(store);
    const progress: string[] = [];
    const visibleAtNotification: boolean[] = [];
    const processPhoto = vi.fn(async (_source: string) => processedPhoto(id));
    let conflictsRemaining = 2;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_CONTROL_KEY && conflictsRemaining > 0) {
        conflictsRemaining -= 1;
        throw new PhotoStoreConflictError(key);
      }
      return originalPut(key, body, options);
    };
    const result = await publishPhotos({
      files: [file],
      store,
      processPhoto,
      onProgress(event) {
        progress.push(event.type);
        if (event.type === "published") {
          const index = store.objects.get(PHOTO_CATALOG_INDEX_KEY);
          visibleAtNotification.push(
            typeof index === "string" && Boolean(JSON.parse(index).photoMonths[id]),
          );
        }
      },
    });
    expect(processPhoto).toHaveBeenCalledTimes(1);
    expect(progress).toEqual(["processing", "published"]);
    expect(visibleAtNotification).toEqual([true]);
    expect(result).toMatchObject({ published: 1, reused: 0 });
    const mediaWrites = store.writes.filter((key) => key.startsWith("media/"));
    expect(mediaWrites).toHaveLength(3);
    expect(new Set(mediaWrites).size).toBe(3);
    await expect(fs.access(path.dirname(processPhoto.mock.calls[0][0]))).rejects.toThrow();
  });

  it("does not replay catalog mutations when a completion callback throws", async () => {
    const file = await createSourceFile("completion callback fails");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    const processPhoto = vi.fn(async () => processedPhoto(id));
    let notifications = 0;
    await expect(
      publishPhotos({
        files: [file],
        store,
        processPhoto,
        onProgress(event) {
          if (event.type === "published") {
            notifications += 1;
            throw new PhotoStoreConflictError("notification");
          }
        },
      }),
    ).rejects.toThrow(PhotoStoreConflictError);
    expect(notifications).toBe(1);
    expect(processPhoto).toHaveBeenCalledTimes(1);
    expect((await readControl(store)).photoMonths[id]).toBe("2026-04");
    expect(store.writes.filter((key) => key.startsWith("media/"))).toHaveLength(3);
  });

  it("reports reuse only once when a concurrent publisher wins the same photo", async () => {
    const file = await createSourceFile("same photo concurrent publication");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    const originalPut = store.put.bind(store);
    const processPhoto = vi.fn(async () => processedPhoto(id));
    const progress: string[] = [];
    let concurrentPublish = true;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_CONTROL_KEY && concurrentPublish) {
        concurrentPublish = false;
        await publishPhotos({
          files: [file],
          store,
          processPhoto: async () => processedPhoto(id),
        });
      }
      return originalPut(key, body, options);
    };
    const result = await publishPhotos({
      files: [file],
      store,
      processPhoto,
      album: { id: "favorites", title: "喜欢" },
      onProgress: (event) => progress.push(event.type),
    });
    expect(processPhoto).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ published: 0, reused: 1 });
    expect(progress).toEqual(["processing", "reused"]);
    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.albums).toEqual([{ id: "favorites", title: "喜欢" }]);
    const referencedKeys = new Set(await publishedObjectKeys(store));
    expect(
      (await readControl(store)).retiredArtifacts.flatMap((entry) => entry.objectKeys),
    ).toEqual(
      expect.arrayContaining(
        [...store.objects.keys()].filter(
          (key) => isPhotoArtifactKey(key) && !referencedKeys.has(key),
        ),
      ),
    );
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

  it("does not replay publish progress after the public index conflicts", async () => {
    const file = await createSourceFile("publish through index conflict");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    const originalPut = store.put.bind(store);
    const progress: string[] = [];
    let conflictPending = true;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_INDEX_KEY && conflictPending) {
        conflictPending = false;
        throw new PhotoStoreConflictError(key);
      }
      return originalPut(key, body, options);
    };

    const result = await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
      onProgress: (event) => progress.push(event.type),
    });

    expect(result).toMatchObject({ published: 1, reused: 0, updatedPeriods: 1 });
    expect(progress).toEqual(["processing", "published"]);
    expect(
      parsePhotoCatalogIndex(JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text)),
    ).toMatchObject({ photoMonths: { [id]: "2026-04" } });
  });

  it("finishes retirement after the public index conflicts", async () => {
    const file = await createSourceFile("retire through index conflict");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
    });
    const originalPut = store.put.bind(store);
    let conflictPending = true;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_INDEX_KEY && conflictPending) {
        conflictPending = false;
        throw new PhotoStoreConflictError(key);
      }
      return originalPut(key, body, options);
    };

    const result = await retirePhotos({ photoIds: [id], store });

    expect(result).toMatchObject({ retired: 1, updatedPeriods: 1 });
    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.photoMonths[id]).toBeUndefined();
  });

  it("repairs a stale public index when retirement is already recorded", async () => {
    const file = await createSourceFile("repair retirement projection");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
    });
    const originalPut = store.put.bind(store);
    let failurePending = true;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_INDEX_KEY && failurePending) {
        failurePending = false;
        throw new Error("public index unavailable");
      }
      return originalPut(key, body, options);
    };

    await expect(retirePhotos({ photoIds: [id], store })).rejects.toThrow(
      "public index unavailable",
    );
    await expect(retirePhotos({ photoIds: [id], store })).rejects.toThrow("不存在照片");
    await migratePhotoCatalog(store);

    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.photoMonths[id]).toBeUndefined();
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

  it("starts the retirement grace period after a delayed public write completes", async () => {
    const file = await createSourceFile("retirement with a delayed public write");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    let now = new Date("2026-08-01T12:00:00.000Z");
    await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
      now: () => now,
    });
    const originalPut = store.put.bind(store);
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_INDEX_KEY) {
        now = new Date("2026-08-02T14:00:00.000Z");
      }
      return originalPut(key, body, options);
    };

    await retirePhotos({ photoIds: [id], store, now: () => now });
    const result = await collectPhotoGarbage({ store, now: () => now });
    expect(result.removedObjects).toBe(0);
    expect(store.deletes).toEqual([]);
    now = new Date("2026-08-03T15:00:00.000Z");
    expect(await collectPhotoGarbage({ store, now: () => now })).toMatchObject({
      removedObjects: 4,
    });
  });

  it("recovers a failed publication confirmation without shortening the grace period", async () => {
    const file = await createSourceFile("retirement confirmation fails after publication");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    let now = new Date("2026-08-01T12:00:00.000Z");
    await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
      now: () => now,
    });
    const originalPut = store.put.bind(store);
    let failConfirmation = true;
    store.put = async (key, body, options) => {
      if (key === PHOTO_CATALOG_CONTROL_KEY && failConfirmation) {
        const control = parsePhotoCatalogControl(JSON.parse(String(body)));
        if (control.retiredArtifacts.some((entry) => entry.deleteAfter !== null)) {
          failConfirmation = false;
          throw new Error("confirmation unavailable");
        }
      }
      return originalPut(key, body, options);
    };
    const onWarning = vi.fn();

    await retirePhotos({ photoIds: [id], store, now: () => now, onWarning });
    expect(onWarning).toHaveBeenCalledWith("照片对象回收未完成: confirmation unavailable");
    now = new Date("2026-08-02T14:00:00.000Z");
    expect(await collectPhotoGarbage({ store, now: () => now })).toMatchObject({
      removedObjects: 0,
    });
    expect(store.deletes).toEqual([]);
    now = new Date("2026-08-03T15:00:00.000Z");
    expect(await collectPhotoGarbage({ store, now: () => now })).toMatchObject({
      removedObjects: 4,
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

  it("publishes when opportunistic garbage collection cannot start", async () => {
    const file = await createSourceFile("publish after garbage collection failure");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    const originalGetText = store.getText.bind(store);
    const warnings: string[] = [];
    let failed = false;
    store.getText = async (key) => {
      if (!failed && store.objects.has(PHOTO_CATALOG_INDEX_KEY)) {
        failed = true;
        throw new Error("garbage catalog unavailable");
      }
      return originalGetText(key);
    };

    const result = await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
      onWarning: (message) => warnings.push(message),
    });

    expect(result.published).toBe(1);
    expect(warnings).toEqual(["照片对象回收未完成: garbage catalog unavailable"]);
  });

  it("hashes and processes the same stable source snapshot", async () => {
    const file = await createSourceFile("original photo state");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    let processedPath = "";

    await publishPhotos({
      files: [file],
      store,
      processPhoto: async (source, sourceId) => {
        processedPath = source;
        await fs.writeFile(file, "changed while publishing");
        expect(await fs.readFile(source, "utf8")).toBe("original photo state");
        expect(sourceId).toBe(id);
        return processedPhoto(sourceId);
      },
    });

    expect(processedPath).not.toBe(file);
    await expect(fs.access(processedPath)).rejects.toThrow();
  });

  it("drains photo processing before disposing source snapshots", async () => {
    const failingFile = await createSourceFile("failing photo");
    const slowFile = await createSourceFile("slow photo");
    const failingId = await hashPhotoFile(failingFile);
    const slowId = await hashPhotoFile(slowFile);
    const store = new MemoryPhotoStore();
    const slowStarted = deferred<void>();
    const releaseSlow = deferred<void>();
    const processedSources: string[] = [];
    let settled = false;

    const operation = publishPhotos({
      files: [failingFile, slowFile],
      store,
      processPhoto: async (source, id) => {
        processedSources.push(source);
        if (id === failingId) {
          await slowStarted.promise;
          throw new Error("processing failed");
        }
        slowStarted.resolve(undefined);
        await releaseSlow.promise;
        expect(await fs.readFile(source, "utf8")).toBe("slow photo");
        return processedPhoto(id);
      },
    }).finally(() => {
      settled = true;
    });

    await slowStarted.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    await fs.access(processedSources[1]);

    releaseSlow.resolve(undefined);
    await expect(operation).rejects.toThrow("processing failed");
    await Promise.all(
      processedSources.map((source) => expect(fs.access(source)).rejects.toThrow()),
    );
    const uploadedKeys = [...store.objects.keys()].filter((key) =>
      key.startsWith(`media/${slowId}`),
    );
    expect(uploadedKeys).toHaveLength(3);
    expect(
      (await readControl(store)).retiredArtifacts.flatMap((entry) => entry.objectKeys),
    ).toEqual(expect.arrayContaining(uploadedKeys));
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

  it("reads only the catalog months needed by a mutation", async () => {
    const januaryFile = await createSourceFile("january photo");
    const februaryFile = await createSourceFile("february photo");
    const marchFile = await createSourceFile("march photo");
    const januaryId = await hashPhotoFile(januaryFile);
    const februaryId = await hashPhotoFile(februaryFile);
    const marchId = await hashPhotoFile(marchFile);
    const store = new MemoryPhotoStore();

    await publishPhotos({
      files: [januaryFile],
      store,
      processPhoto: async () => processedPhoto(januaryId, "2026-01-10T12:00:00+08:00"),
    });
    await publishPhotos({
      files: [februaryFile],
      store,
      processPhoto: async () => processedPhoto(februaryId, "2026-02-10T12:00:00+08:00"),
    });

    store.reads.length = 0;
    await publishPhotos({
      files: [marchFile],
      store,
      processPhoto: async () => processedPhoto(marchId, "2026-03-10T12:00:00+08:00"),
    });
    expect(store.reads.filter((key) => key.startsWith("catalog/months/"))).toEqual([]);

    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    const januaryPath = index.periods.find((period) => period.month === "2026-01")!.path;
    store.reads.length = 0;
    await publishPhotos({
      files: [januaryFile],
      store,
      album: { id: "favorites", title: "喜欢" },
      processPhoto: async () => {
        throw new Error("existing photo should not be processed");
      },
    });
    expect(store.reads.filter((key) => key.startsWith("catalog/months/"))).toEqual([januaryPath]);
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

  it("returns a committed deletion when opportunistic garbage collection fails", async () => {
    const file = await createSourceFile("delete before garbage collection failure");
    const id = await hashPhotoFile(file);
    const store = new MemoryPhotoStore();
    await publishPhotos({
      files: [file],
      store,
      processPhoto: async () => processedPhoto(id),
    });

    const originalGetText = store.getText.bind(store);
    const originalPut = store.put.bind(store);
    const warnings: string[] = [];
    let failNextRead = false;
    store.getText = async (key) => {
      if (failNextRead) {
        failNextRead = false;
        throw new Error("garbage catalog unavailable");
      }
      return originalGetText(key);
    };
    store.put = async (key, body, options) => {
      const version = await originalPut(key, body, options);
      if (key === PHOTO_CATALOG_INDEX_KEY) {
        failNextRead = true;
      }
      return version;
    };

    const result = await retirePhotos({
      photoIds: [id],
      store,
      onWarning: (message) => warnings.push(message),
    });

    expect(result.retired).toBe(1);
    expect(warnings).toEqual(["照片对象回收未完成: garbage catalog unavailable"]);
    expect((await readControl(store)).photoMonths).toEqual({});
  });

  it("retires replaced month shards and removes them only after the cache grace period", async () => {
    const firstFile = await createSourceFile("first month revision");
    const secondFile = await createSourceFile("second month revision");
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
    const replacedPath = firstIndex.periods[0].path;

    await publishPhotos({
      files: [secondFile],
      store,
      processPhoto: async () => processedPhoto(secondId),
      now: () => new Date("2026-08-02T12:00:00.000Z"),
    });
    let index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.periods[0].path).not.toBe(replacedPath);
    let control = await readControl(store);
    expect(control.retiredArtifacts).toEqual([
      expect.objectContaining({ objectKeys: [replacedPath] }),
    ]);
    expect(store.objects.has(replacedPath)).toBe(true);

    expect(
      await collectPhotoGarbage({
        store,
        now: () => new Date("2026-08-03T12:00:00.000Z"),
      }),
    ).toMatchObject({ removedObjects: 0, pendingArtifacts: 1 });
    expect(
      await collectPhotoGarbage({
        store,
        now: () => new Date("2026-08-03T14:00:00.000Z"),
      }),
    ).toMatchObject({ removedObjects: 1, pendingArtifacts: 0 });

    control = await readControl(store);
    expect(control.retiredArtifacts).toEqual([]);
    expect(store.objects.has(replacedPath)).toBe(false);
  });

  it("keeps retired month paths separate when their contents are restored", async () => {
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
      now: () => new Date("2026-08-01T13:00:00.000Z"),
    });
    await retirePhotos({
      photoIds: [secondId],
      store,
      now: () => new Date("2026-08-01T14:00:00.000Z"),
    });

    const index = parsePhotoCatalogIndex(
      JSON.parse((await store.getText(PHOTO_CATALOG_INDEX_KEY))!.text),
    );
    expect(index.periods[0].path).not.toBe(revivedPath);
    expect(store.objects.get(index.periods[0].path)).toBe(store.objects.get(revivedPath));
    const control = await readControl(store);
    expect(control.retiredArtifacts.flatMap((entry) => entry.objectKeys)).toContain(revivedPath);
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
    });

    await expect(collectPhotoGarbage({ store })).rejects.toThrow("仍被主 Catalog 引用");
    expect(store.deletes).toEqual([]);
    for (const key of keys) {
      expect(store.objects.has(key), key).toBe(true);
    }
  });

  it.each(["memory", "filesystem"])(
    "preserves republished objects after an expired worker resumes in %s",
    async (backend) => {
      const file = await createSourceFile("republished after expired garbage claim");
      const id = await hashPhotoFile(file);
      const store: PhotoObjectStore =
        backend === "memory"
          ? new MemoryPhotoStore()
          : new FilePhotoObjectStore(path.join(path.dirname(file), "objects"));
      const publish = (timestamp: string) =>
        publishPhotos({
          files: [file],
          store,
          processPhoto: async () => processedPhoto(id),
          now: () => new Date(timestamp),
        });
      await publish("2026-08-01T12:00:00.000Z");
      await retirePhotos({
        photoIds: [id],
        store,
        now: () => new Date("2026-08-01T13:00:00.000Z"),
      });

      const deletionStarted = deferred<void>();
      const releaseDeletion = deferred<void>();
      const originalDelete = store.delete.bind(store);
      let pause = true;
      let paused = 0;
      store.delete = async (key) => {
        if (pause) {
          if (++paused === 4) {
            deletionStarted.resolve();
          }
          await releaseDeletion.promise;
        }
        return originalDelete(key);
      };
      const oldWorker = collectPhotoGarbage({
        store,
        now: () => new Date("2026-08-02T15:00:00.000Z"),
      });
      await deletionStarted.promise;
      pause = false;
      try {
        await collectPhotoGarbage({
          store,
          now: () => new Date("2026-08-02T16:01:00.000Z"),
        });
        await publish("2026-08-02T16:02:00.000Z");
        const republishedKeys = await publishedObjectKeys(store);
        releaseDeletion.resolve();
        await oldWorker;
        const missing = (
          await Promise.all(
            republishedKeys.map(async (key) => ((await store.getText(key)) ? null : key)),
          )
        ).filter(Boolean);
        expect(missing).toEqual([]);
        expect((await readControl(store)).photoMonths[id]).toBe("2026-04");
      } finally {
        releaseDeletion.resolve();
        await oldWorker;
      }
    },
  );

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
