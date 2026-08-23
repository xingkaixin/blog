import { createHash } from "node:crypto";
import {
  PHOTO_CATALOG_INDEX_KEY,
  PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
  comparePhotosNewestFirst,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  photoAlbumCounts,
  validatePhotoMonth,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import {
  PHOTO_CATALOG_CONTROL_KEY,
  parseLegacyPhotoCatalogControl,
  parsePhotoCatalogControl,
  photoCatalogIndexFromControl,
  type PhotoCatalogControl,
} from "./photo-catalog-control";
import { PhotoCatalogState } from "./photo-catalog-state";
import { PhotoStoreConflictError, type PhotoObjectStore } from "./photo-store";

const SHARD_CACHE_CONTROL = "public, max-age=31536000, immutable";
const INDEX_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=86400";
const CONTROL_CACHE_CONTROL = "no-store";
const READ_CONCURRENCY = 8;
const WRITE_CONCURRENCY = 2;
const CATALOG_COMMIT_ATTEMPTS = 5;

export async function loadPhotoCatalog(store: PhotoObjectStore): Promise<PhotoCatalogState> {
  const [controlObject, indexObject] = await Promise.all([
    store.getText(PHOTO_CATALOG_CONTROL_KEY),
    store.getText(PHOTO_CATALOG_INDEX_KEY),
  ]);
  const rawIndex = indexObject ? parseJson(indexObject.text, PHOTO_CATALOG_INDEX_KEY) : null;
  const control = controlObject
    ? parsePhotoCatalogControl(parseJson(controlObject.text, PHOTO_CATALOG_CONTROL_KEY))
    : rawIndex
      ? parseLegacyPhotoCatalogControl(rawIndex)
      : null;
  let publicIndex: PhotoCatalogIndex | null = null;
  if (rawIndex) {
    try {
      publicIndex = parsePhotoCatalogIndex(rawIndex);
    } catch (error) {
      if (!controlObject) {
        throw error;
      }
    }
  }

  if (!control) {
    return PhotoCatalogState.empty();
  }

  const expectedPublicIndex = photoCatalogIndexFromControl(control);
  return PhotoCatalogState.loaded(control, {
    control: controlObject?.version ?? null,
    publicIndex: indexObject?.version ?? null,
    publicIndexCurrent:
      (rawIndex as { schemaVersion?: unknown } | null)?.schemaVersion ===
        PHOTO_CATALOG_INDEX_SCHEMA_VERSION &&
      JSON.stringify(publicIndex) === JSON.stringify(expectedPublicIndex),
  });
}

export async function loadPhotoCatalogMonths(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
  months: Iterable<string>,
): Promise<void> {
  if (catalog.generatedAt === null) {
    return;
  }
  const periods = [...new Set(months)]
    .filter((month) => !catalog.hasLoadedMonth(month))
    .map((month) => catalog.period(month))
    .filter((period): period is PhotoPeriod => Boolean(period));
  const loadedMonths = await readPhotoCatalogMonths(store, catalog.currentIndex(), periods);
  for (const { shard } of loadedMonths) {
    catalog.loadMonth(shard);
  }
}

export async function writePhotoCatalog(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
  generatedAt: Date,
  attemptedArtifacts: Set<string> = new Set(),
  writtenArtifacts: Set<string> = new Set(),
): Promise<void> {
  const nextPeriods = catalog.periods();

  await mapWithConcurrency(catalog.dirtyMonths(), WRITE_CONCURRENCY, async (month) => {
    const shard = catalog.monthForWrite(month);
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
    if (catalog.isArtifactDeletionClaimed(key)) {
      throw new Error(`照片对象 ${key} 正在回收，请稍后重试`);
    }
    if (!writtenArtifacts.has(key)) {
      attemptedArtifacts.add(key);
      await store.put(key, body, {
        contentType: "application/json; charset=utf-8",
        cacheControl: SHARD_CACHE_CONTROL,
      });
      writtenArtifacts.add(key);
    }
    nextPeriods.set(month, {
      month,
      count: validatedShard.photos.length,
      albumCounts: photoAlbumCounts(validatedShard.photos),
      path: key,
    });
  });

  const control = catalog.prepareControl(nextPeriods, generatedAt, attemptedArtifacts);
  await writeControlDocument(store, catalog, control);
  await writePublicIndex(store, catalog, photoCatalogIndexFromControl(control));
}

export async function writePhotoCatalogControl(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
): Promise<void> {
  if (catalog.generatedAt === null) {
    throw new Error("无法写入空的照片 Catalog 控制状态");
  }
  await writeControlDocument(store, catalog, catalog.currentControl());
}

export async function writePhotoCatalogIndex(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
): Promise<void> {
  if (catalog.generatedAt === null) {
    throw new Error("无法发布空的照片 Catalog 投影");
  }
  if (catalog.controlVersion === null) {
    await writeControlDocument(store, catalog, catalog.currentControl());
  }
  await writePublicIndex(store, catalog, catalog.currentIndex());
}

export async function migratePhotoCatalog(store: PhotoObjectStore): Promise<boolean> {
  return retryPhotoCatalogMutation(async () => {
    const catalog = await loadPhotoCatalog(store);
    if (catalog.generatedAt === null) {
      throw new Error("无法迁移空的照片 Catalog");
    }
    if (catalog.controlVersion !== null && catalog.publicIndexCurrent) {
      return false;
    }
    await writePhotoCatalogIndex(store, catalog);
    return true;
  });
}

async function writePublicIndex(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
  index: PhotoCatalogIndex,
): Promise<void> {
  const version = await store.put(PHOTO_CATALOG_INDEX_KEY, serializeJson(index), {
    contentType: "application/json; charset=utf-8",
    cacheControl: INDEX_CACHE_CONTROL,
    expectedVersion: catalog.publicIndexVersion,
  });
  catalog.recordPublicIndexWrite(version);
}

async function writeControlDocument(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
  control: PhotoCatalogControl,
): Promise<void> {
  const version = await store.put(PHOTO_CATALOG_CONTROL_KEY, serializeJson(control), {
    contentType: "application/json; charset=utf-8",
    cacheControl: CONTROL_CACHE_CONTROL,
    expectedVersion: catalog.controlVersion,
  });
  catalog.recordControlWrite(version, control);
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
