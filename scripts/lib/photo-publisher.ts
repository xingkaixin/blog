import { createHash } from "node:crypto";
import path from "node:path";
import {
  PHOTO_CATALOG_INDEX_KEY,
  PHOTO_CATALOG_SCHEMA_VERSION,
  PHOTO_VARIANT_WIDTHS,
  isPhotoAlbumId,
  isPhotoArtifactKey,
  isPhotoId,
  monthFromCapturedAt,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  parsePhotoRecord,
  photoIdFromMediaObjectKey,
  validatePhotoCatalog,
  validatePhotoMonth,
  type PhotoAlbum,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
  type RetiredArtifactBatch,
  type RetiredPhotoObjects,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import type { ProcessedPhoto } from "./photo-source";
import { snapshotPhotoFile, type PhotoSourceSnapshot } from "./photo-source";
import { PhotoStoreConflictError, type PhotoObjectStore } from "./photo-store";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const SHARD_CACHE_CONTROL = "public, max-age=31536000, immutable";
const INDEX_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=86400";
const PROCESS_CONCURRENCY = 2;
const READ_CONCURRENCY = 8;
const CATALOG_COMMIT_ATTEMPTS = 5;
const RETIRED_OBJECT_GRACE_MS = 25 * 60 * 60 * 1_000;
export type PublishAlbum = {
  id: string;
  title?: string;
};

export type PublishProgress =
  | { type: "processing"; file: string; index: number; total: number }
  | { type: "reused"; file: string }
  | { type: "published"; file: string; photoId: string };

export type PublishPhotosOptions = {
  files: string[];
  store: PhotoObjectStore;
  processPhoto: (file: string, id: string) => Promise<ProcessedPhoto>;
  album?: PublishAlbum;
  now?: () => Date;
  onProgress?: (progress: PublishProgress) => void;
  onWarning?: (message: string) => void;
};

export type PublishPhotosResult = {
  discovered: number;
  published: number;
  reused: number;
  updatedPeriods: number;
  catalogChanged: boolean;
};

export type DeletePhotosOptions = {
  photoIds: string[];
  store: PhotoObjectStore;
  now?: () => Date;
  onWarning?: (message: string) => void;
};

export type DeletePhotosResult = {
  deleted: number;
  alreadyRetired: number;
  retiredObjects: number;
  updatedPeriods: number;
};

export type CollectPhotoGarbageOptions = {
  store: PhotoObjectStore;
  now?: () => Date;
};

export type CollectPhotoGarbageResult = {
  removedObjects: number;
  failedObjects: number;
  pendingPhotos: number;
  pendingArtifacts: number;
  failures: PhotoGarbageFailure[];
};

export type PhotoGarbageFailure = {
  objectKey: string;
  message: string;
};

type GarbageDeletionResult =
  | { status: "referenced" }
  | { status: "removed" }
  | { status: "failed"; message: string };

type LoadedCatalog = {
  index: PhotoCatalogIndex | null;
  indexVersion: string | null;
  albums: Map<string, PhotoAlbum>;
  months: Map<string, PhotoMonthCatalog>;
  periods: Map<string, PhotoPeriod>;
  photoMonths: Map<string, string>;
  retiredObjects: Map<string, RetiredPhotoObjects>;
  retiredArtifacts: Map<string, RetiredArtifactBatch>;
};

type IdentifiedFile = PhotoSourceSnapshot;

export async function publishPhotos(options: PublishPhotosOptions): Promise<PublishPhotosResult> {
  validateAlbum(options.album);
  const now = options.now?.() ?? new Date();
  const identifiedFiles = await identifyFiles(options.files);
  const processedPhotos = new Map<string, ProcessedPhoto>();
  const attemptedArtifacts = new Set<string>();
  try {
    reportGarbageFailures(
      await collectPhotoGarbage({ store: options.store, now: () => now }),
      options.onWarning,
    );
    try {
      return await retryCatalogMutation(() =>
        publishPhotosOnce(
          { ...options, now: () => now },
          identifiedFiles,
          processedPhotos,
          attemptedArtifacts,
        ),
      );
    } catch (error) {
      try {
        await recordFailedPublishArtifacts(options.store, attemptedArtifacts, now);
      } catch (retirementError) {
        const failure = new AggregateError(
          [error, retirementError],
          "照片发布失败，且无法记录已写入的待回收产物",
        );
        throw failure;
      }
      throw error;
    }
  } finally {
    await Promise.all(identifiedFiles.map((file) => file.dispose()));
  }
}

async function publishPhotosOnce(
  options: PublishPhotosOptions,
  identifiedFiles: IdentifiedFile[],
  processedPhotos: Map<string, ProcessedPhoto>,
  attemptedArtifacts: Set<string>,
): Promise<PublishPhotosResult> {
  const uniqueFiles = uniqueFilesByContent(identifiedFiles);
  const catalog = await loadCatalog(options.store);
  await loadCatalogMonths(
    options.store,
    catalog,
    uniqueFiles.flatMap((file) => catalog.photoMonths.get(file.id) ?? []),
  );
  const albumChanged = applyAlbum(catalog.albums, options.album);
  const dirtyMonths = new Set<string>();
  const pending: IdentifiedFile[] = [];
  let reused = identifiedFiles.length - uniqueFiles.length;

  for (const identified of uniqueFiles) {
    if (catalog.retiredObjects.has(identified.id)) {
      throw new Error(`照片 ${identified.id} 正在延迟回收，请在回收完成后重新发布`);
    }
    const existingMonth = catalog.photoMonths.get(identified.id);
    if (!existingMonth) {
      pending.push(identified);
      continue;
    }

    reused += 1;
    options.onProgress?.({ type: "reused", file: identified.file });
    if (options.album && addPhotoToAlbum(catalog, identified.id, existingMonth, options.album.id)) {
      dirtyMonths.add(existingMonth);
    }
  }

  const processed = await mapWithConcurrency(
    pending,
    PROCESS_CONCURRENCY,
    async (identified, index) => {
      let photo = processedPhotos.get(identified.id);
      if (!photo) {
        options.onProgress?.({
          type: "processing",
          file: identified.file,
          index: index + 1,
          total: pending.length,
        });
        photo = await options.processPhoto(identified.source, identified.id);
      }
      if (photo.id !== identified.id) {
        throw new Error(`照片处理器返回了错误的内容 ID: ${photo.id}`);
      }
      processedPhotos.set(photo.id, photo);
      const record = validateNewPhoto(photo, options.album?.id);
      return { file: identified.file, photo, record };
    },
  );

  await loadCatalogMonths(
    options.store,
    catalog,
    processed.map(({ record }) => monthFromCapturedAt(record.capturedAt)),
  );
  await mapWithConcurrency(processed, PROCESS_CONCURRENCY, async ({ file, photo }) => {
    await uploadPhotoAssets(options.store, photo, attemptedArtifacts);
    options.onProgress?.({
      type: "published",
      file,
      photoId: photo.id,
    });
  });

  for (const { record } of processed) {
    const month = monthFromCapturedAt(record.capturedAt);
    const monthCatalog = catalog.months.get(month) ?? {
      schemaVersion: PHOTO_CATALOG_SCHEMA_VERSION,
      month,
      photos: [],
    };
    monthCatalog.photos.push(record);
    catalog.months.set(month, monthCatalog);
    catalog.photoMonths.set(record.id, month);
    dirtyMonths.add(month);
  }

  const catalogChanged =
    albumChanged ||
    dirtyMonths.size > 0 ||
    hasUnreferencedArtifacts(catalog, catalog.periods, attemptedArtifacts);
  if (catalogChanged) {
    await writeCatalog(
      options.store,
      catalog,
      dirtyMonths,
      options.now?.() ?? new Date(),
      attemptedArtifacts,
    );
  }

  return {
    discovered: identifiedFiles.length,
    published: processed.length,
    reused,
    updatedPeriods: dirtyMonths.size,
    catalogChanged,
  };
}

export async function deletePhotos(options: DeletePhotosOptions): Promise<DeletePhotosResult> {
  const now = options.now?.() ?? new Date();
  const result = await retryCatalogMutation(() => deletePhotosOnce({ ...options, now: () => now }));
  reportGarbageFailures(
    await collectPhotoGarbage({ store: options.store, now: () => now }),
    options.onWarning,
  );
  return result;
}

async function deletePhotosOnce(options: DeletePhotosOptions): Promise<DeletePhotosResult> {
  const photoIds = [...new Set(options.photoIds)];
  if (photoIds.length === 0) {
    throw new Error("至少需要指定一张照片");
  }
  if (photoIds.some((photoId) => !isPhotoId(photoId))) {
    throw new Error("照片 ID 必须是 32 位小写十六进制内容 ID");
  }

  const catalog = await loadCatalog(options.store);
  const alreadyRetired = photoIds.filter((photoId) => catalog.retiredObjects.has(photoId));
  const activePhotoIds = photoIds.filter((photoId) => !catalog.retiredObjects.has(photoId));
  await loadCatalogMonths(
    options.store,
    catalog,
    activePhotoIds.flatMap((photoId) => catalog.photoMonths.get(photoId) ?? []),
  );
  const targets = activePhotoIds.map((photoId) => {
    const month = catalog.photoMonths.get(photoId);
    const photo = month
      ? catalog.months.get(month)?.photos.find((item) => item.id === photoId)
      : null;
    if (!month || !photo) {
      throw new Error(`Catalog 中不存在照片 ${photoId}`);
    }
    return { month, photo };
  });
  const dirtyMonths = new Set(targets.map(({ month }) => month));

  if (targets.length === 0) {
    return {
      deleted: 0,
      alreadyRetired: alreadyRetired.length,
      retiredObjects: 0,
      updatedPeriods: 0,
    };
  }

  for (const { month, photo } of targets) {
    const monthCatalog = catalog.months.get(month);
    if (!monthCatalog) {
      throw new Error(`缺少照片 ${photo.id} 所属月份 ${month}`);
    }
    monthCatalog.photos = monthCatalog.photos.filter((item) => item.id !== photo.id);
    catalog.photoMonths.delete(photo.id);
  }
  const deleteAfter = new Date(
    (options.now?.() ?? new Date()).getTime() + RETIRED_OBJECT_GRACE_MS,
  ).toISOString();
  const objectKeys = new Set<string>();
  for (const { month, photo } of targets) {
    const photoObjectKeys = new Set<string>();
    const oldPeriodPath = catalog.periods.get(month)?.path;
    if (oldPeriodPath) {
      objectKeys.add(oldPeriodPath);
    }
    for (const width of PHOTO_VARIANT_WIDTHS) {
      photoObjectKeys.add(`media/${photo.id}/${width}.webp`);
    }
    const retired: RetiredPhotoObjects = {
      photoId: photo.id,
      objectKeys: [...photoObjectKeys].toSorted(),
      deleteAfter,
    };
    catalog.retiredObjects.set(photo.id, retired);
    for (const key of photoObjectKeys) {
      objectKeys.add(key);
    }
  }
  await writeCatalog(options.store, catalog, dirtyMonths, options.now?.() ?? new Date());

  return {
    deleted: activePhotoIds.length,
    alreadyRetired: alreadyRetired.length,
    retiredObjects: objectKeys.size,
    updatedPeriods: dirtyMonths.size,
  };
}

export async function collectPhotoGarbage(
  options: CollectPhotoGarbageOptions,
): Promise<CollectPhotoGarbageResult> {
  return retryCatalogMutation(() => collectPhotoGarbageOnce(options));
}

async function collectPhotoGarbageOnce(
  options: CollectPhotoGarbageOptions,
): Promise<CollectPhotoGarbageResult> {
  const now = options.now?.() ?? new Date();
  const catalog = await loadCatalog(options.store);
  const duePhotos = [...catalog.retiredObjects.values()].filter(
    (entry) => Date.parse(entry.deleteAfter) <= now.getTime(),
  );
  const dueArtifacts = [...catalog.retiredArtifacts.values()].filter(
    (entry) => Date.parse(entry.deleteAfter) <= now.getTime(),
  );
  if (duePhotos.length === 0 && dueArtifacts.length === 0) {
    return {
      removedObjects: 0,
      failedObjects: 0,
      pendingPhotos: catalog.retiredObjects.size,
      pendingArtifacts: catalog.retiredArtifacts.size,
      failures: [],
    };
  }

  const objectKeys = [
    ...new Set([
      ...duePhotos.flatMap((entry) => entry.objectKeys),
      ...dueArtifacts.flatMap((entry) => entry.objectKeys),
    ]),
  ];
  const deletionResults = new Map<string, GarbageDeletionResult>(
    await mapWithConcurrency(
      objectKeys,
      READ_CONCURRENCY,
      async (key): Promise<[string, GarbageDeletionResult]> => {
        if (isArtifactReferenced(catalog.periods, catalog.photoMonths, key)) {
          return [key, { status: "referenced" }];
        }
        try {
          await options.store.delete(key);
          return [key, { status: "removed" }];
        } catch (error) {
          return [
            key,
            {
              status: "failed",
              message: error instanceof Error ? error.message : String(error),
            },
          ];
        }
      },
    ),
  );
  const completedPhotos = duePhotos.filter((entry) =>
    entry.objectKeys.every((key) => deletionResults.get(key)?.status !== "failed"),
  );
  const completedArtifacts = dueArtifacts.filter((entry) =>
    entry.objectKeys.every((key) => deletionResults.get(key)?.status !== "failed"),
  );
  for (const entry of completedPhotos) {
    catalog.retiredObjects.delete(entry.photoId);
  }
  for (const entry of completedArtifacts) {
    catalog.retiredArtifacts.delete(entry.retirementId);
  }
  if (completedPhotos.length > 0 || completedArtifacts.length > 0) {
    await writeCatalog(options.store, catalog, new Set(), now);
  }

  const failures: PhotoGarbageFailure[] = [];
  for (const [objectKey, result] of deletionResults) {
    if (result.status === "failed") {
      failures.push({ objectKey, message: result.message });
    }
  }

  return {
    removedObjects: [...deletionResults.values()].filter((result) => result.status === "removed")
      .length,
    failedObjects: failures.length,
    pendingPhotos: catalog.retiredObjects.size,
    pendingArtifacts: catalog.retiredArtifacts.size,
    failures,
  };
}

function validateNewPhoto(photo: ProcessedPhoto, albumId: string | undefined): PhotoRecord {
  return parsePhotoRecord({
    id: photo.id,
    capturedAt: photo.capturedAt,
    width: photo.width,
    height: photo.height,
    albumIds: albumId ? [albumId] : [],
    placeholderColor: photo.placeholderColor,
  });
}

function validateAlbum(album: PublishAlbum | undefined): void {
  if (!album) {
    return;
  }
  if (!isPhotoAlbumId(album.id)) {
    throw new Error("相册 ID 只能包含小写字母、数字和连字符");
  }
  if (album.title !== undefined && (album.title.trim().length === 0 || album.title.length > 80)) {
    throw new Error("相册标题长度必须在 1 到 80 之间");
  }
}

function applyAlbum(albums: Map<string, PhotoAlbum>, album: PublishAlbum | undefined): boolean {
  if (!album) {
    return false;
  }

  const existing = albums.get(album.id);
  if (!existing) {
    if (!album.title) {
      throw new Error(`新相册 ${album.id} 必须同时提供 --album-title`);
    }
    albums.set(album.id, { id: album.id, title: album.title.trim() });
    return true;
  }

  if (album.title && existing.title !== album.title.trim()) {
    albums.set(album.id, { id: album.id, title: album.title.trim() });
    return true;
  }
  return false;
}

async function identifyFiles(files: string[]): Promise<IdentifiedFile[]> {
  const snapshots: IdentifiedFile[] = [];
  try {
    return await mapWithConcurrency(files, READ_CONCURRENCY, async (file) => {
      const snapshot = await snapshotPhotoFile(file);
      snapshots.push(snapshot);
      return snapshot;
    });
  } catch (error) {
    await Promise.all(snapshots.map((snapshot) => snapshot.dispose()));
    throw error;
  }
}

function uniqueFilesByContent(files: IdentifiedFile[]): IdentifiedFile[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (seen.has(file.id)) {
      return false;
    }
    seen.add(file.id);
    return true;
  });
}

function addPhotoToAlbum(
  catalog: LoadedCatalog,
  photoId: string,
  month: string,
  albumId: string,
): boolean {
  const photo = catalog.months.get(month)?.photos.find((candidate) => candidate.id === photoId);
  if (!photo || photo.albumIds.includes(albumId)) {
    return false;
  }
  photo.albumIds = [...photo.albumIds, albumId].toSorted();
  return true;
}

async function uploadPhotoAssets(
  store: PhotoObjectStore,
  photo: ProcessedPhoto,
  attemptedArtifacts: Set<string>,
): Promise<void> {
  await mapWithConcurrency(PHOTO_VARIANT_WIDTHS, PROCESS_CONCURRENCY, async (width) => {
    const body = photo.variants.get(width);
    if (!body) {
      throw new Error(`照片 ${photo.id} 缺少 ${width}px 版本`);
    }
    const key = `media/${photo.id}/${width}.webp`;
    attemptedArtifacts.add(key);
    await store.put(key, body, {
      contentType: "image/webp",
      cacheControl: ASSET_CACHE_CONTROL,
    });
  });
}

async function loadCatalog(store: PhotoObjectStore): Promise<LoadedCatalog> {
  const indexObject = await store.getText(PHOTO_CATALOG_INDEX_KEY);
  if (!indexObject) {
    return {
      index: null,
      indexVersion: null,
      albums: new Map(),
      months: new Map(),
      periods: new Map(),
      photoMonths: new Map(),
      retiredObjects: new Map(),
      retiredArtifacts: new Map(),
    };
  }

  const index = parsePhotoCatalogIndex(parseJson(indexObject.text, PHOTO_CATALOG_INDEX_KEY));

  const catalog: LoadedCatalog = {
    index,
    indexVersion: indexObject.version,
    albums: new Map(index.albums.map((album) => [album.id, album])),
    months: new Map(),
    periods: new Map(index.periods.map((period) => [period.month, period])),
    photoMonths: new Map(Object.entries(index.photoMonths)),
    retiredObjects: new Map(index.retiredObjects.map((entry) => [entry.photoId, entry])),
    retiredArtifacts: new Map(index.retiredArtifacts.map((entry) => [entry.retirementId, entry])),
  };
  const photoCount = index.periods.reduce((sum, period) => sum + period.count, 0);
  if (photoCount > 0 && Object.keys(index.photoMonths).length === 0) {
    const loadedMonths = await readCatalogMonths(store, index, index.periods);
    const validated = validatePhotoCatalog(
      index,
      loadedMonths.map(({ shard }) => shard),
    );
    catalog.months = validated.months;
    catalog.photoMonths = validated.photoMonths;
  }
  return catalog;
}

async function loadCatalogMonths(
  store: PhotoObjectStore,
  catalog: LoadedCatalog,
  months: Iterable<string>,
): Promise<void> {
  if (!catalog.index) {
    return;
  }
  const periods = [...new Set(months)]
    .filter((month) => !catalog.months.has(month))
    .map((month) => catalog.periods.get(month))
    .filter((period): period is PhotoPeriod => Boolean(period));
  const loadedMonths = await readCatalogMonths(store, catalog.index, periods);
  for (const { period, shard } of loadedMonths) {
    catalog.months.set(period.month, shard);
  }
}

async function readCatalogMonths(
  store: PhotoObjectStore,
  index: PhotoCatalogIndex,
  periods: PhotoPeriod[],
): Promise<Array<{ period: PhotoPeriod; shard: PhotoMonthCatalog }>> {
  return mapWithConcurrency(periods, READ_CONCURRENCY, async (period) => {
    const shardObject = await store.getText(period.path);
    if (!shardObject) {
      throw new Error(`Catalog 引用了不存在的月份索引 ${period.path}`);
    }
    const shard = parsePhotoMonthCatalog(parseJson(shardObject.text, period.path));
    validatePhotoMonth(index, period, shard);
    return { period, shard };
  });
}

async function writeCatalog(
  store: PhotoObjectStore,
  catalog: LoadedCatalog,
  dirtyMonths: Set<string>,
  generatedAt: Date,
  attemptedArtifacts: Set<string> = new Set(),
): Promise<void> {
  const nextPeriods = new Map(catalog.periods);

  await mapWithConcurrency([...dirtyMonths], PROCESS_CONCURRENCY, async (month) => {
    const shard = catalog.months.get(month);
    if (!shard) {
      throw new Error(`缺少待写入的月份 ${month}`);
    }
    if (shard.photos.length === 0) {
      nextPeriods.delete(month);
      return;
    }
    shard.photos.sort(comparePhotosNewestFirst);
    const validatedShard = parsePhotoMonthCatalog(shard);
    const body = serializeJson(validatedShard);
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 24);
    const key = `catalog/months/${month}.${hash}.json`;
    attemptedArtifacts.add(key);
    await store.put(key, body, {
      contentType: "application/json; charset=utf-8",
      cacheControl: SHARD_CACHE_CONTROL,
    });
    nextPeriods.set(month, {
      month,
      count: validatedShard.photos.length,
      albumCounts: countAlbums(validatedShard.photos),
      path: key,
    });
  });

  const replacedPeriodPaths = [...catalog.periods]
    .filter(([month, period]) => nextPeriods.get(month)?.path !== period.path)
    .map(([, period]) => period.path);
  retireUnreferencedArtifacts(
    catalog,
    nextPeriods,
    new Set([...attemptedArtifacts, ...replacedPeriodPaths]),
    generatedAt,
  );
  keepOnlyUnreferencedRetirements(catalog, nextPeriods);

  const referencedAlbums = new Set(
    [...nextPeriods.values()].flatMap((period) => Object.keys(period.albumCounts)),
  );
  for (const albumId of catalog.albums.keys()) {
    if (!referencedAlbums.has(albumId)) {
      catalog.albums.delete(albumId);
    }
  }
  const albums = [...catalog.albums.values()].toSorted((left, right) =>
    left.id.localeCompare(right.id),
  );
  const periods = [...nextPeriods.values()].toSorted((left, right) =>
    right.month.localeCompare(left.month),
  );
  const index = parsePhotoCatalogIndex({
    schemaVersion: PHOTO_CATALOG_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    albums,
    periods,
    photoMonths: Object.fromEntries(
      [...catalog.photoMonths].toSorted(([left], [right]) => left.localeCompare(right)),
    ),
    retiredObjects: [...catalog.retiredObjects.values()].toSorted(
      (left, right) =>
        left.deleteAfter.localeCompare(right.deleteAfter) ||
        left.photoId.localeCompare(right.photoId),
    ),
    retiredArtifacts: [...catalog.retiredArtifacts.values()].toSorted(
      (left, right) =>
        left.deleteAfter.localeCompare(right.deleteAfter) ||
        left.retirementId.localeCompare(right.retirementId),
    ),
  });

  await store.put(PHOTO_CATALOG_INDEX_KEY, serializeJson(index), {
    contentType: "application/json; charset=utf-8",
    cacheControl: INDEX_CACHE_CONTROL,
    expectedVersion: catalog.indexVersion,
  });
}

async function recordFailedPublishArtifacts(
  store: PhotoObjectStore,
  attemptedArtifacts: Set<string>,
  failedAt: Date,
): Promise<void> {
  if (attemptedArtifacts.size === 0) {
    return;
  }
  await retryCatalogMutation(async () => {
    const catalog = await loadCatalog(store);
    if (!hasUnreferencedArtifacts(catalog, catalog.periods, attemptedArtifacts)) {
      return;
    }
    await writeCatalog(store, catalog, new Set(), failedAt, attemptedArtifacts);
  });
}

function hasUnreferencedArtifacts(
  catalog: LoadedCatalog,
  periods: Map<string, PhotoPeriod>,
  objectKeys: Iterable<string>,
): boolean {
  const retiredKeys = allRetiredObjectKeys(catalog);
  return [...objectKeys].some(
    (key) => !retiredKeys.has(key) && !isArtifactReferenced(periods, catalog.photoMonths, key),
  );
}

function retireUnreferencedArtifacts(
  catalog: LoadedCatalog,
  periods: Map<string, PhotoPeriod>,
  objectKeys: Set<string>,
  retiredAt: Date,
): void {
  const retiredKeys = allRetiredObjectKeys(catalog);
  const candidates = [...objectKeys]
    .filter((key) => {
      if (!isPhotoArtifactKey(key)) {
        throw new Error(`无法回收未知的照片对象路径 ${key}`);
      }
      return !retiredKeys.has(key) && !isArtifactReferenced(periods, catalog.photoMonths, key);
    })
    .toSorted();
  if (candidates.length === 0) {
    return;
  }

  const deleteAfter = new Date(retiredAt.getTime() + RETIRED_OBJECT_GRACE_MS).toISOString();
  const retirementId = createHash("sha256")
    .update(`${deleteAfter}\n${candidates.join("\n")}`)
    .digest("hex")
    .slice(0, 24);
  catalog.retiredArtifacts.set(retirementId, {
    retirementId,
    objectKeys: candidates,
    deleteAfter,
  });
}

function keepOnlyUnreferencedRetirements(
  catalog: LoadedCatalog,
  periods: Map<string, PhotoPeriod>,
): void {
  for (const [photoId, entry] of catalog.retiredObjects) {
    const objectKeys = entry.objectKeys.filter(
      (key) => !isArtifactReferenced(periods, catalog.photoMonths, key),
    );
    if (objectKeys.length === 0 || catalog.photoMonths.has(photoId)) {
      catalog.retiredObjects.delete(photoId);
    } else if (objectKeys.length !== entry.objectKeys.length) {
      catalog.retiredObjects.set(photoId, { ...entry, objectKeys });
    }
  }

  for (const [retirementId, entry] of catalog.retiredArtifacts) {
    const objectKeys = entry.objectKeys.filter(
      (key) => !isArtifactReferenced(periods, catalog.photoMonths, key),
    );
    if (objectKeys.length === 0) {
      catalog.retiredArtifacts.delete(retirementId);
    } else if (objectKeys.length !== entry.objectKeys.length) {
      catalog.retiredArtifacts.set(retirementId, { ...entry, objectKeys });
    }
  }
}

function allRetiredObjectKeys(catalog: LoadedCatalog): Set<string> {
  return new Set([
    ...[...catalog.retiredObjects.values()].flatMap((entry) => entry.objectKeys),
    ...[...catalog.retiredArtifacts.values()].flatMap((entry) => entry.objectKeys),
  ]);
}

function isArtifactReferenced(
  periods: Map<string, PhotoPeriod>,
  photoMonths: Map<string, string>,
  key: string,
): boolean {
  if ([...periods.values()].some((period) => period.path === key)) {
    return true;
  }
  const photoId = photoIdFromMediaObjectKey(key);
  return photoId !== null && photoMonths.has(photoId);
}

function reportGarbageFailures(
  result: CollectPhotoGarbageResult,
  warn: (message: string) => void = console.warn,
): void {
  for (const failure of result.failures) {
    warn(`照片对象回收失败 ${failure.objectKey}: ${failure.message}`);
  }
}

async function retryCatalogMutation<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= CATALOG_COMMIT_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof PhotoStoreConflictError) || attempt === CATALOG_COMMIT_ATTEMPTS) {
        throw error;
      }
    }
  }
  throw new Error("照片 Catalog 提交重试次数耗尽");
}

function countAlbums(photos: PhotoRecord[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const photo of photos) {
    for (const albumId of photo.albumIds) {
      counts.set(albumId, (counts.get(albumId) ?? 0) + 1);
    }
  }
  return Object.fromEntries(
    [...counts.entries()].toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

function comparePhotosNewestFirst(left: PhotoRecord, right: PhotoRecord): number {
  const timeDifference = Date.parse(right.capturedAt) - Date.parse(left.capturedAt);
  return timeDifference || right.id.localeCompare(left.id);
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(value: string, key: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`对象 ${key} 不是有效的 JSON`);
  }
}

export function photoDisplayName(file: string): string {
  return path.basename(file);
}
