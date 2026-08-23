import { createHash } from "node:crypto";
import {
  PHOTO_CATALOG_INDEX_KEY,
  PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
  comparePhotosNewestFirst,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  photoAlbumCounts,
  validatePhotoMonth,
  type PhotoAlbum,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type RetiredArtifactBatch,
  type RetiredPhotoObjects,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import {
  isPhotoArtifactDeletionClaimed,
  keepOnlyUnreferencedPhotoRetirements,
  retireUnreferencedPhotoArtifacts,
} from "./photo-retirement";
import { PhotoStoreConflictError, type PhotoObjectStore } from "./photo-store";

const SHARD_CACHE_CONTROL = "public, max-age=31536000, immutable";
const INDEX_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=86400";
const READ_CONCURRENCY = 8;
const WRITE_CONCURRENCY = 2;
const CATALOG_COMMIT_ATTEMPTS = 5;

export type LoadedPhotoCatalog = {
  index: PhotoCatalogIndex | null;
  indexVersion: string | null;
  albums: Map<string, PhotoAlbum>;
  months: Map<string, PhotoMonthCatalog>;
  periods: Map<string, PhotoPeriod>;
  photoMonths: Map<string, string>;
  retiredObjects: Map<string, RetiredPhotoObjects>;
  retiredArtifacts: Map<string, RetiredArtifactBatch>;
};

export async function loadPhotoCatalog(store: PhotoObjectStore): Promise<LoadedPhotoCatalog> {
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
  return {
    index,
    indexVersion: indexObject.version,
    albums: new Map(index.albums.map((album) => [album.id, album])),
    months: new Map(),
    periods: new Map(index.periods.map((period) => [period.month, period])),
    photoMonths: new Map(Object.entries(index.photoMonths)),
    retiredObjects: new Map(index.retiredObjects.map((entry) => [entry.photoId, entry])),
    retiredArtifacts: new Map(index.retiredArtifacts.map((entry) => [entry.retirementId, entry])),
  };
}

export async function loadPhotoCatalogMonths(
  store: PhotoObjectStore,
  catalog: LoadedPhotoCatalog,
  months: Iterable<string>,
): Promise<void> {
  if (!catalog.index) {
    return;
  }
  const periods = [...new Set(months)]
    .filter((month) => !catalog.months.has(month))
    .map((month) => catalog.periods.get(month))
    .filter((period): period is PhotoPeriod => Boolean(period));
  const loadedMonths = await readPhotoCatalogMonths(store, catalog.index, periods);
  for (const { period, shard } of loadedMonths) {
    catalog.months.set(period.month, shard);
  }
}

export async function writePhotoCatalog(
  store: PhotoObjectStore,
  catalog: LoadedPhotoCatalog,
  dirtyMonths: Set<string>,
  generatedAt: Date,
  attemptedArtifacts: Set<string> = new Set(),
): Promise<void> {
  const nextPeriods = new Map(catalog.periods);

  await mapWithConcurrency([...dirtyMonths], WRITE_CONCURRENCY, async (month) => {
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
    if (isPhotoArtifactDeletionClaimed(catalog, key)) {
      throw new Error(`照片对象 ${key} 正在回收，请稍后重试`);
    }
    attemptedArtifacts.add(key);
    await store.put(key, body, {
      contentType: "application/json; charset=utf-8",
      cacheControl: SHARD_CACHE_CONTROL,
    });
    nextPeriods.set(month, {
      month,
      count: validatedShard.photos.length,
      albumCounts: photoAlbumCounts(validatedShard.photos),
      path: key,
    });
  });

  const replacedPeriodPaths = [...catalog.periods]
    .filter(([month, period]) => nextPeriods.get(month)?.path !== period.path)
    .map(([, period]) => period.path);
  retireUnreferencedPhotoArtifacts(
    catalog,
    nextPeriods,
    new Set([...attemptedArtifacts, ...replacedPeriodPaths]),
    generatedAt,
  );
  keepOnlyUnreferencedPhotoRetirements(catalog, nextPeriods);
  removeEmptyAlbums(catalog, nextPeriods);

  const index = parsePhotoCatalogIndex({
    schemaVersion: PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    albums: [...catalog.albums.values()].toSorted((left, right) => left.id.localeCompare(right.id)),
    periods: [...nextPeriods.values()].toSorted((left, right) =>
      right.month.localeCompare(left.month),
    ),
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

export async function retryPhotoCatalogMutation<T>(operation: () => Promise<T>): Promise<T> {
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

async function readPhotoCatalogMonths(
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

function removeEmptyAlbums(catalog: LoadedPhotoCatalog, periods: Map<string, PhotoPeriod>): void {
  const referencedAlbums = new Set(
    [...periods.values()].flatMap((period) => Object.keys(period.albumCounts)),
  );
  for (const albumId of catalog.albums.keys()) {
    if (!referencedAlbums.has(albumId)) {
      catalog.albums.delete(albumId);
    }
  }
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
