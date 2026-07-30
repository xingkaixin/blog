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
  type PhotoAlbum,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
} from "../../src/lib/photo-catalog";
import type { ProcessedPhoto } from "./photo-source";
import { hashPhotoFile } from "./photo-source";
import type { PhotoObjectStore } from "./photo-store";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const SHARD_CACHE_CONTROL = "public, max-age=31536000, immutable";
const INDEX_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=86400";
const PROCESS_CONCURRENCY = 2;
const READ_CONCURRENCY = 8;

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

type LoadedCatalog = {
  index: PhotoCatalogIndex | null;
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
  const indexText = await store.getText(PHOTO_CATALOG_INDEX_KEY);
  if (!indexText) {
    return {
      index: null,
      albums: new Map(),
      months: new Map(),
      periodPaths: new Map(),
      photoMonths: new Map(),
    };
  }

  const index = parsePhotoCatalogIndex(parseJson(indexText, PHOTO_CATALOG_INDEX_KEY));
  const knownAlbumIds = new Set(index.albums.map((album) => album.id));
  const months = new Map<string, PhotoMonthCatalog>();
  const periodPaths = new Map<string, string>();
  const photoMonths = new Map<string, string>();

  const loadedMonths = await mapLimit(index.periods, READ_CONCURRENCY, async (period) => {
    const shardText = await store.getText(period.path);
    if (!shardText) {
      throw new Error(`Catalog 引用了不存在的月份索引 ${period.path}`);
    }
    const shard = parsePhotoMonthCatalog(parseJson(shardText, period.path));
    validatePeriod(period, shard);
    return { period, shard };
  });

  for (const { period, shard } of loadedMonths) {
    months.set(shard.month, shard);
    periodPaths.set(shard.month, period.path);
    for (const photo of shard.photos) {
      for (const albumId of photo.albumIds) {
        if (!knownAlbumIds.has(albumId)) {
          throw new Error(`照片 ${photo.id} 引用了不存在的相册 ${albumId}`);
        }
      }
      if (photoMonths.has(photo.id)) {
        throw new Error(`照片 ${photo.id} 在多个 Catalog 月份中重复出现`);
      }
      photoMonths.set(photo.id, shard.month);
    }
  }

  return {
    index,
    albums: new Map(index.albums.map((album) => [album.id, album])),
    months,
    periodPaths,
    photoMonths,
  };
}

function validatePeriod(period: PhotoPeriod, shard: PhotoMonthCatalog): void {
  if (period.month !== shard.month || period.count !== shard.photos.length) {
    throw new Error(`月份索引 ${period.path} 与主 Catalog 不一致`);
  }

  const actualAlbumCounts = countAlbums(shard.photos);
  const expectedEntries = Object.entries(period.albumCounts);
  const countsMatch =
    expectedEntries.length === Object.keys(actualAlbumCounts).length &&
    expectedEntries.every(([albumId, count]) => actualAlbumCounts[albumId] === count);
  if (!countsMatch) {
    throw new Error(`月份索引 ${period.path} 的相册计数与主 Catalog 不一致`);
  }
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
  };

  await store.put(PHOTO_CATALOG_INDEX_KEY, serializeJson(index), {
    contentType: "application/json; charset=utf-8",
    cacheControl: INDEX_CACHE_CONTROL,
  });
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
