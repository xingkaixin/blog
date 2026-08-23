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
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import {
  PHOTO_CATALOG_CONTROL_KEY,
  PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
  parseLegacyPhotoCatalogControl,
  parsePhotoCatalogControl,
  photoCatalogIndexFromControl,
  type PhotoCatalogControl,
  type RetiredArtifactBatch,
  type RetiredPhotoObjects,
} from "./photo-catalog-control";
import {
  isPhotoArtifactDeletionClaimed,
  keepOnlyUnreferencedPhotoRetirements,
  retireUnreferencedPhotoArtifacts,
} from "./photo-retirement";
import { PhotoStoreConflictError, type PhotoObjectStore } from "./photo-store";

const SHARD_CACHE_CONTROL = "public, max-age=31536000, immutable";
const INDEX_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=86400";
const CONTROL_CACHE_CONTROL = "no-store";
const READ_CONCURRENCY = 8;
const WRITE_CONCURRENCY = 2;
const CATALOG_COMMIT_ATTEMPTS = 5;

export type LoadedPhotoCatalog = {
  generatedAt: string | null;
  controlVersion: string | null;
  publicIndexVersion: string | null;
  publicIndexCurrent: boolean;
  albums: Map<string, PhotoAlbum>;
  months: Map<string, PhotoMonthCatalog>;
  periods: Map<string, PhotoPeriod>;
  photoMonths: Map<string, string>;
  retiredObjects: Map<string, RetiredPhotoObjects>;
  retiredArtifacts: Map<string, RetiredArtifactBatch>;
};

export async function loadPhotoCatalog(store: PhotoObjectStore): Promise<LoadedPhotoCatalog> {
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
    return {
      generatedAt: null,
      controlVersion: null,
      publicIndexVersion: null,
      publicIndexCurrent: true,
      albums: new Map(),
      months: new Map(),
      periods: new Map(),
      photoMonths: new Map(),
      retiredObjects: new Map(),
      retiredArtifacts: new Map(),
    };
  }

  const expectedPublicIndex = photoCatalogIndexFromControl(control);
  return {
    generatedAt: control.generatedAt,
    controlVersion: controlObject?.version ?? null,
    publicIndexVersion: indexObject?.version ?? null,
    publicIndexCurrent:
      (rawIndex as { schemaVersion?: unknown } | null)?.schemaVersion ===
        PHOTO_CATALOG_INDEX_SCHEMA_VERSION &&
      JSON.stringify(publicIndex) === JSON.stringify(expectedPublicIndex),
    albums: new Map(control.albums.map((album) => [album.id, album])),
    months: new Map(),
    periods: new Map(control.periods.map((period) => [period.month, period])),
    photoMonths: new Map(Object.entries(control.photoMonths)),
    retiredObjects: new Map(control.retiredObjects.map((entry) => [entry.photoId, entry])),
    retiredArtifacts: new Map(control.retiredArtifacts.map((entry) => [entry.retirementId, entry])),
  };
}

export async function loadPhotoCatalogMonths(
  store: PhotoObjectStore,
  catalog: LoadedPhotoCatalog,
  months: Iterable<string>,
): Promise<void> {
  if (catalog.generatedAt === null) {
    return;
  }
  const periods = [...new Set(months)]
    .filter((month) => !catalog.months.has(month))
    .map((month) => catalog.periods.get(month))
    .filter((period): period is PhotoPeriod => Boolean(period));
  const loadedMonths = await readPhotoCatalogMonths(store, catalogIndex(catalog), periods);
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
  writtenArtifacts: Set<string> = new Set(),
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

  const control = buildControl(catalog, nextPeriods, generatedAt.toISOString());
  catalog.controlVersion = await store.put(PHOTO_CATALOG_CONTROL_KEY, serializeJson(control), {
    contentType: "application/json; charset=utf-8",
    cacheControl: CONTROL_CACHE_CONTROL,
    expectedVersion: catalog.controlVersion,
  });
  catalog.generatedAt = control.generatedAt;
  catalog.periods = nextPeriods;
  await writePublicIndex(store, catalog, photoCatalogIndexFromControl(control));
}

export async function writePhotoCatalogIndex(
  store: PhotoObjectStore,
  catalog: LoadedPhotoCatalog,
): Promise<void> {
  if (catalog.generatedAt === null) {
    throw new Error("无法发布空的照片 Catalog 投影");
  }
  const control = buildControl(catalog, catalog.periods, catalog.generatedAt);
  if (catalog.controlVersion === null) {
    catalog.controlVersion = await store.put(PHOTO_CATALOG_CONTROL_KEY, serializeJson(control), {
      contentType: "application/json; charset=utf-8",
      cacheControl: CONTROL_CACHE_CONTROL,
      expectedVersion: null,
    });
  }
  await writePublicIndex(store, catalog, photoCatalogIndexFromControl(control));
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
  catalog: LoadedPhotoCatalog,
  index: PhotoCatalogIndex,
): Promise<void> {
  catalog.publicIndexVersion = await store.put(PHOTO_CATALOG_INDEX_KEY, serializeJson(index), {
    contentType: "application/json; charset=utf-8",
    cacheControl: INDEX_CACHE_CONTROL,
    expectedVersion: catalog.publicIndexVersion,
  });
  catalog.publicIndexCurrent = true;
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

function buildControl(
  catalog: LoadedPhotoCatalog,
  periods: Map<string, PhotoPeriod>,
  generatedAt: string,
): PhotoCatalogControl {
  return parsePhotoCatalogControl({
    schemaVersion: PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
    generatedAt,
    albums: [...catalog.albums.values()].toSorted((left, right) => left.id.localeCompare(right.id)),
    periods: [...periods.values()].toSorted((left, right) => right.month.localeCompare(left.month)),
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
}

function catalogIndex(catalog: LoadedPhotoCatalog): PhotoCatalogIndex {
  if (catalog.generatedAt === null) {
    throw new Error("照片 Catalog 尚未初始化");
  }
  return parsePhotoCatalogIndex({
    schemaVersion: PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
    generatedAt: catalog.generatedAt,
    albums: [...catalog.albums.values()],
    periods: [...catalog.periods.values()],
    photoMonths: Object.fromEntries(catalog.photoMonths),
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
