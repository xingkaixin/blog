import { createHash } from "node:crypto";
import path from "node:path";
import {
  PHOTO_CATALOG_INDEX_KEY,
  PHOTO_CATALOG_SCHEMA_VERSION,
  PHOTO_VARIANT_WIDTHS,
  isPhotoAlbumId,
  monthFromCapturedAt,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  validatePhotoCatalog,
  type PhotoAlbum,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
} from "../../src/lib/photo-catalog";
import type { ProcessedPhoto } from "./photo-source";
import { hashPhotoFile } from "./photo-source";
import { PhotoStoreConflictError, type PhotoObjectStore } from "./photo-store";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const SHARD_CACHE_CONTROL = "public, max-age=31536000, immutable";
const INDEX_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=86400";
const PROCESS_CONCURRENCY = 2;
const READ_CONCURRENCY = 8;
const CATALOG_COMMIT_ATTEMPTS = 5;
const PHOTO_ID_PATTERN = /^[a-f0-9]{32}$/;

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
};

export type DeletePhotosResult = {
  deleted: number;
  removedObjects: number;
  updatedPeriods: number;
};

type LoadedCatalog = {
  index: PhotoCatalogIndex | null;
  indexVersion: string | null;
  albums: Map<string, PhotoAlbum>;
  months: Map<string, PhotoMonthCatalog>;
  periodPaths: Map<string, string>;
  photoMonths: Map<string, string>;
};

type IdentifiedFile = {
  file: string;
  id: string;
};

export async function publishPhotos(options: PublishPhotosOptions): Promise<PublishPhotosResult> {
  return retryCatalogMutation(() => publishPhotosOnce(options));
}

async function publishPhotosOnce(options: PublishPhotosOptions): Promise<PublishPhotosResult> {
  validateAlbum(options.album);
  const catalog = await loadCatalog(options.store);
  const albumChanged = applyAlbum(catalog.albums, options.album);
  const identifiedFiles = await identifyFiles(options.files);
  const uniqueFiles = uniqueFilesByContent(identifiedFiles);
  const dirtyMonths = new Set<string>();
  const pending: IdentifiedFile[] = [];
  let reused = identifiedFiles.length - uniqueFiles.length;

  for (const identified of uniqueFiles) {
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

  const processed = await mapLimit(pending, PROCESS_CONCURRENCY, async (identified, index) => {
    options.onProgress?.({
      type: "processing",
      file: identified.file,
      index: index + 1,
      total: pending.length,
    });
    const photo = await options.processPhoto(identified.file, identified.id);
    if (photo.id !== identified.id) {
      throw new Error(`照片处理器返回了错误的内容 ID: ${photo.id}`);
    }
    const record = validateNewPhoto(photo, options.album?.id);
    await uploadPhotoAssets(options.store, photo);
    options.onProgress?.({
      type: "published",
      file: identified.file,
      photoId: photo.id,
    });
    return record;
  });

  for (const record of processed) {
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

  const catalogChanged = albumChanged || dirtyMonths.size > 0;
  if (catalogChanged) {
    await writeCatalog(options.store, catalog, dirtyMonths, options.now?.() ?? new Date());
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
  return retryCatalogMutation(() => deletePhotosOnce(options));
}

async function deletePhotosOnce(options: DeletePhotosOptions): Promise<DeletePhotosResult> {
  const photoIds = [...new Set(options.photoIds)];
  if (photoIds.length === 0) {
    throw new Error("至少需要指定一张照片");
  }
  if (photoIds.some((photoId) => !PHOTO_ID_PATTERN.test(photoId))) {
    throw new Error("照片 ID 必须是 32 位小写十六进制内容 ID");
  }

  const catalog = await loadCatalog(options.store);
  const targets = photoIds.map((photoId) => {
    const month = catalog.photoMonths.get(photoId);
    const photo = month
      ? catalog.months.get(month)?.photos.find((item) => item.id === photoId)
      : null;
    if (!month || !photo) {
      throw new Error(`Catalog 中不存在照片 ${photoId}`);
    }
    return { month, photo };
  });
  const oldPeriodPaths = new Set(
    targets
      .map(({ month }) => catalog.periodPaths.get(month))
      .filter((periodPath): periodPath is string => Boolean(periodPath)),
  );
  const dirtyMonths = new Set(targets.map(({ month }) => month));

  for (const { month, photo } of targets) {
    const monthCatalog = catalog.months.get(month);
    if (!monthCatalog) {
      throw new Error(`缺少照片 ${photo.id} 所属月份 ${month}`);
    }
    monthCatalog.photos = monthCatalog.photos.filter((item) => item.id !== photo.id);
    catalog.photoMonths.delete(photo.id);
  }
  removeUnusedAlbums(catalog);
  await writeCatalog(options.store, catalog, dirtyMonths, options.now?.() ?? new Date());

  const objectKeys = new Set(oldPeriodPaths);
  for (const photoId of photoIds) {
    for (const width of PHOTO_VARIANT_WIDTHS) {
      objectKeys.add(`media/${photoId}/${width}.webp`);
    }
  }
  await Promise.all([...objectKeys].map((key) => options.store.delete(key)));

  return {
    deleted: photoIds.length,
    removedObjects: objectKeys.size,
    updatedPeriods: dirtyMonths.size,
  };
}

function validateNewPhoto(photo: ProcessedPhoto, albumId: string | undefined): PhotoRecord {
  const record: PhotoRecord = {
    id: photo.id,
    capturedAt: photo.capturedAt,
    width: photo.width,
    height: photo.height,
    albumIds: albumId ? [albumId] : [],
    placeholderColor: photo.placeholderColor,
  };
  const month = monthFromCapturedAt(record.capturedAt);
  return parsePhotoMonthCatalog({
    schemaVersion: PHOTO_CATALOG_SCHEMA_VERSION,
    month,
    photos: [record],
  }).photos[0];
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
  return mapLimit(files, READ_CONCURRENCY, async (file) => ({
    file,
    id: await hashPhotoFile(file),
  }));
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

async function uploadPhotoAssets(store: PhotoObjectStore, photo: ProcessedPhoto): Promise<void> {
  await Promise.all(
    PHOTO_VARIANT_WIDTHS.map(async (width) => {
      const body = photo.variants.get(width);
      if (!body) {
        throw new Error(`照片 ${photo.id} 缺少 ${width}px 版本`);
      }
      await store.put(`media/${photo.id}/${width}.webp`, body, {
        contentType: "image/webp",
        cacheControl: ASSET_CACHE_CONTROL,
      });
    }),
  );
}

async function loadCatalog(store: PhotoObjectStore): Promise<LoadedCatalog> {
  const indexObject = await store.getText(PHOTO_CATALOG_INDEX_KEY);
  if (!indexObject) {
    return {
      index: null,
      indexVersion: null,
      albums: new Map(),
      months: new Map(),
      periodPaths: new Map(),
      photoMonths: new Map(),
    };
  }

  const index = parsePhotoCatalogIndex(parseJson(indexObject.text, PHOTO_CATALOG_INDEX_KEY));

  const loadedMonths = await mapLimit(index.periods, READ_CONCURRENCY, async (period) => {
    const shardObject = await store.getText(period.path);
    if (!shardObject) {
      throw new Error(`Catalog 引用了不存在的月份索引 ${period.path}`);
    }
    const shard = parsePhotoMonthCatalog(parseJson(shardObject.text, period.path));
    return { period, shard };
  });
  const validated = validatePhotoCatalog(
    index,
    loadedMonths.map(({ shard }) => shard),
  );

  return {
    index,
    indexVersion: indexObject.version,
    albums: new Map(index.albums.map((album) => [album.id, album])),
    months: validated.months,
    periodPaths: new Map(loadedMonths.map(({ period }) => [period.month, period.path])),
    photoMonths: validated.photoMonths,
  };
}

async function writeCatalog(
  store: PhotoObjectStore,
  catalog: LoadedCatalog,
  dirtyMonths: Set<string>,
  generatedAt: Date,
): Promise<void> {
  const nextPaths = new Map(catalog.periodPaths);

  await Promise.all(
    [...dirtyMonths].map(async (month) => {
      const shard = catalog.months.get(month);
      if (!shard) {
        throw new Error(`缺少待写入的月份 ${month}`);
      }
      if (shard.photos.length === 0) {
        nextPaths.delete(month);
        return;
      }
      shard.photos.sort(comparePhotosNewestFirst);
      const validatedShard = parsePhotoMonthCatalog(shard);
      const body = serializeJson(validatedShard);
      const hash = createHash("sha256").update(body).digest("hex").slice(0, 24);
      const key = `catalog/months/${month}.${hash}.json`;
      await store.put(key, body, {
        contentType: "application/json; charset=utf-8",
        cacheControl: SHARD_CACHE_CONTROL,
      });
      nextPaths.set(month, key);
    }),
  );

  const albums = [...catalog.albums.values()].toSorted((left, right) =>
    left.id.localeCompare(right.id),
  );
  const periods = [...catalog.months.values()]
    .filter((month) => month.photos.length > 0)
    .toSorted((left, right) => right.month.localeCompare(left.month))
    .map((month): PhotoPeriod => {
      const periodPath = nextPaths.get(month.month);
      if (!periodPath) {
        throw new Error(`月份 ${month.month} 缺少内容寻址路径`);
      }
      return {
        month: month.month,
        count: month.photos.length,
        albumCounts: countAlbums(month.photos),
        path: periodPath,
      };
    });
  const index: PhotoCatalogIndex = {
    schemaVersion: PHOTO_CATALOG_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    albums,
    periods,
    photoMonths: Object.fromEntries(
      [...catalog.photoMonths].toSorted(([left], [right]) => left.localeCompare(right)),
    ),
  };

  await store.put(PHOTO_CATALOG_INDEX_KEY, serializeJson(index), {
    contentType: "application/json; charset=utf-8",
    cacheControl: INDEX_CACHE_CONTROL,
    expectedVersion: catalog.indexVersion,
  });
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

function removeUnusedAlbums(catalog: LoadedCatalog): void {
  const referencedAlbums = new Set(
    [...catalog.months.values()].flatMap((month) =>
      month.photos.flatMap((photo) => photo.albumIds),
    ),
  );
  for (const albumId of catalog.albums.keys()) {
    if (!referencedAlbums.has(albumId)) {
      catalog.albums.delete(albumId);
    }
  }
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

async function mapLimit<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  results.length = values.length;
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export function photoDisplayName(file: string): string {
  return path.basename(file);
}
