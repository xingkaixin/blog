import { isPhotoTimestamp } from "./photo-timestamp";

export const PHOTO_CATALOG_INDEX_SCHEMA_VERSION = 3 as const;
export const PHOTO_MONTH_CATALOG_SCHEMA_VERSION = 1 as const;
export const PHOTO_VARIANT_WIDTHS = [480, 960, 2048] as const;
export const PHOTO_THUMBNAIL_WIDTH = PHOTO_VARIANT_WIDTHS[0];
export const PHOTO_DISPLAY_WIDTH = PHOTO_VARIANT_WIDTHS[1];
export const PHOTO_FULL_WIDTH = PHOTO_VARIANT_WIDTHS[2];
export const PHOTO_CATALOG_INDEX_KEY = "catalog/index.json";

export type PhotoVariantWidth = (typeof PHOTO_VARIANT_WIDTHS)[number];

export type PhotoAlbum = {
  id: string;
  title: string;
};

export type PhotoRecord = {
  id: string;
  capturedAt: string;
  width: number;
  height: number;
  albumIds: string[];
  placeholderColor: string;
};

export type PhotoPeriod = {
  month: string;
  count: number;
  albumCounts: Record<string, number>;
  path: string;
};

export type PhotoCatalogIndex = {
  schemaVersion: typeof PHOTO_CATALOG_INDEX_SCHEMA_VERSION;
  generatedAt: string;
  albums: PhotoAlbum[];
  periods: PhotoPeriod[];
  photoMonths: Record<string, string>;
};

export type PhotoMonthCatalog = {
  schemaVersion: typeof PHOTO_MONTH_CATALOG_SCHEMA_VERSION;
  month: string;
  photos: PhotoRecord[];
};

const ALBUM_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const PHOTO_ID_PATTERN = /^[a-f0-9]{32}$/;
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const COLOR_PATTERN = /^#[a-f0-9]{6}$/;
const PERIOD_PATH_PATTERN = /^catalog\/months\/\d{4}-(?:0[1-9]|1[0-2])\.[a-f0-9]{24}\.json$/;
const MAX_IMAGE_DIMENSION = 100_000;
const LEGACY_PHOTO_CATALOG_INDEX_SCHEMA_VERSION = 2;

export class PhotoCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoCatalogError";
  }
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PhotoCatalogError(`${field} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new PhotoCatalogError(`${field} 必须是字符串`);
  }
  return value;
}

function readInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new PhotoCatalogError(`${field} 必须是 ${minimum} 到 ${maximum} 之间的整数`);
  }
  return value as number;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new PhotoCatalogError(`${field} 必须是数组`);
  }
  return value.map((item, index) => readString(item, `${field}[${index}]`));
}

function assertUnique(values: string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new PhotoCatalogError(`${field} 不能包含重复值`);
  }
}

function readTimestamp(value: unknown, field: string): string {
  const timestamp = readString(value, field);
  if (!isPhotoTimestamp(timestamp)) {
    throw new PhotoCatalogError(`${field} 必须是包含时区的 ISO 时间`);
  }
  return timestamp;
}

function readMonth(value: unknown, field: string): string {
  const month = readString(value, field);
  if (!MONTH_PATTERN.test(month)) {
    throw new PhotoCatalogError(`${field} 必须是 YYYY-MM`);
  }
  return month;
}

function readAlbum(value: unknown, field: string): PhotoAlbum {
  const album = readRecord(value, field);
  const id = readString(album.id, `${field}.id`);
  const title = readString(album.title, `${field}.title`).trim();

  if (!isPhotoAlbumId(id)) {
    throw new PhotoCatalogError(`${field}.id 只能包含小写字母、数字和连字符`);
  }
  if (title.length === 0 || title.length > 80) {
    throw new PhotoCatalogError(`${field}.title 长度必须在 1 到 80 之间`);
  }

  return { id, title };
}

function readAlbumCounts(value: unknown, field: string, count: number): Record<string, number> {
  const input = readRecord(value, field);
  const output: Record<string, number> = {};

  for (const [albumId, albumCount] of Object.entries(input)) {
    if (!isPhotoAlbumId(albumId)) {
      throw new PhotoCatalogError(`${field} 包含无效的相册 ID`);
    }
    output[albumId] = readInteger(albumCount, `${field}.${albumId}`, 0, count);
  }

  return output;
}

function readPeriod(value: unknown, field: string): PhotoPeriod {
  const period = readRecord(value, field);
  const month = readMonth(period.month, `${field}.month`);
  const count = readInteger(period.count, `${field}.count`, 0, Number.MAX_SAFE_INTEGER);
  const path = readString(period.path, `${field}.path`);

  if (!PERIOD_PATH_PATTERN.test(path) || !path.includes(`/${month}.`)) {
    throw new PhotoCatalogError(`${field}.path 不是有效的月份索引路径`);
  }

  return {
    month,
    count,
    albumCounts: readAlbumCounts(period.albumCounts, `${field}.albumCounts`, count),
    path,
  };
}

function readPhotoMonths(value: unknown): Record<string, string> {
  const input = readRecord(value, "catalog.photoMonths");
  const output: Record<string, string> = {};
  for (const [photoId, month] of Object.entries(input)) {
    if (!isPhotoId(photoId)) {
      throw new PhotoCatalogError("catalog.photoMonths 包含无效的照片 ID");
    }
    output[photoId] = readMonth(month, `catalog.photoMonths.${photoId}`);
  }
  return output;
}

function readPhoto(value: unknown, field: string): PhotoRecord {
  const photo = readRecord(value, field);
  const id = readString(photo.id, `${field}.id`);
  const capturedAt = readTimestamp(photo.capturedAt, `${field}.capturedAt`);
  const albumIds = readStringArray(photo.albumIds, `${field}.albumIds`);
  const placeholderColor = readString(photo.placeholderColor, `${field}.placeholderColor`);

  if (!isPhotoId(id)) {
    throw new PhotoCatalogError(`${field}.id 必须是 32 位十六进制内容 ID`);
  }
  if (!albumIds.every(isPhotoAlbumId)) {
    throw new PhotoCatalogError(`${field}.albumIds 包含无效的相册 ID`);
  }
  assertUnique(albumIds, `${field}.albumIds`);
  if (!COLOR_PATTERN.test(placeholderColor)) {
    throw new PhotoCatalogError(`${field}.placeholderColor 必须是小写十六进制颜色`);
  }

  return {
    id,
    capturedAt,
    width: readInteger(photo.width, `${field}.width`, 1, MAX_IMAGE_DIMENSION),
    height: readInteger(photo.height, `${field}.height`, 1, MAX_IMAGE_DIMENSION),
    albumIds,
    placeholderColor,
  };
}

export function parsePhotoRecord(value: unknown): PhotoRecord {
  return readPhoto(value, "photo");
}

function assertNewestFirst<T>(
  items: T[],
  readOrderValue: (item: T) => string,
  field: string,
): void {
  for (let index = 1; index < items.length; index += 1) {
    if (readOrderValue(items[index - 1]) < readOrderValue(items[index])) {
      throw new PhotoCatalogError(`${field} 必须按时间从新到旧排列`);
    }
  }
}

function assertPhotosNewestFirst(photos: PhotoRecord[]): void {
  for (let index = 1; index < photos.length; index += 1) {
    const previous = photos[index - 1];
    const current = photos[index];
    if (comparePhotosNewestFirst(previous, current) > 0) {
      throw new PhotoCatalogError("monthCatalog.photos 必须按拍摄时间从新到旧排列");
    }
  }
}

export function comparePhotosNewestFirst(left: PhotoRecord, right: PhotoRecord): number {
  const timeDifference = Date.parse(right.capturedAt) - Date.parse(left.capturedAt);
  return timeDifference || right.id.localeCompare(left.id);
}

export function isPhotoAlbumId(value: string): boolean {
  return ALBUM_ID_PATTERN.test(value);
}

export function isPhotoId(value: string): boolean {
  return PHOTO_ID_PATTERN.test(value);
}

export function monthFromCapturedAt(capturedAt: string): string {
  return capturedAt.slice(0, 7);
}

export function parsePhotoCatalogIndex(value: unknown): PhotoCatalogIndex {
  const input = readRecord(value, "catalog");
  if (
    input.schemaVersion !== LEGACY_PHOTO_CATALOG_INDEX_SCHEMA_VERSION &&
    input.schemaVersion !== PHOTO_CATALOG_INDEX_SCHEMA_VERSION
  ) {
    throw new PhotoCatalogError("不支持的照片 Catalog 版本");
  }

  const generatedAt = readTimestamp(input.generatedAt, "catalog.generatedAt");
  if (!Array.isArray(input.albums) || !Array.isArray(input.periods)) {
    throw new PhotoCatalogError("catalog.albums 和 catalog.periods 必须是数组");
  }

  const albums = input.albums.map((album, index) => readAlbum(album, `catalog.albums[${index}]`));
  const periods = input.periods.map((period, index) =>
    readPeriod(period, `catalog.periods[${index}]`),
  );
  const photoMonths = readPhotoMonths(input.photoMonths);

  assertUnique(
    albums.map((album) => album.id),
    "catalog.albums",
  );
  assertUnique(
    periods.map((period) => period.month),
    "catalog.periods",
  );
  assertNewestFirst(periods, (period) => period.month, "catalog.periods");

  const albumIds = new Set(albums.map((album) => album.id));
  const periodMonths = new Set(periods.map((period) => period.month));
  for (const period of periods) {
    for (const albumId of Object.keys(period.albumCounts)) {
      if (!albumIds.has(albumId)) {
        throw new PhotoCatalogError(`月份 ${period.month} 引用了不存在的相册 ${albumId}`);
      }
    }
  }
  for (const [photoId, month] of Object.entries(photoMonths)) {
    if (!periodMonths.has(month)) {
      throw new PhotoCatalogError(`照片 ${photoId} 指向不存在的月份 ${month}`);
    }
  }
  const totalPhotoCount = periods.reduce((sum, period) => sum + period.count, 0);
  if (Object.keys(photoMonths).length !== totalPhotoCount) {
    throw new PhotoCatalogError("catalog.photoMonths 必须完整覆盖所有照片");
  }

  return {
    schemaVersion: PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
    generatedAt,
    albums,
    periods,
    photoMonths,
  };
}

export function parsePhotoMonthCatalog(value: unknown): PhotoMonthCatalog {
  const input = readRecord(value, "monthCatalog");
  if (input.schemaVersion !== PHOTO_MONTH_CATALOG_SCHEMA_VERSION) {
    throw new PhotoCatalogError("不支持的照片月份 Catalog 版本");
  }
  if (!Array.isArray(input.photos)) {
    throw new PhotoCatalogError("monthCatalog.photos 必须是数组");
  }

  const month = readMonth(input.month, "monthCatalog.month");
  const photos = input.photos.map((photo, index) =>
    readPhoto(photo, `monthCatalog.photos[${index}]`),
  );

  assertUnique(
    photos.map((photo) => photo.id),
    "monthCatalog.photos",
  );
  assertPhotosNewestFirst(photos);

  for (const photo of photos) {
    if (monthFromCapturedAt(photo.capturedAt) !== month) {
      throw new PhotoCatalogError(`照片 ${photo.id} 的拍摄月份与月份 Catalog 不一致`);
    }
  }

  return {
    schemaVersion: PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
    month,
    photos,
  };
}

export function validatePhotoMonth(
  index: PhotoCatalogIndex,
  period: PhotoPeriod,
  shard: PhotoMonthCatalog,
): PhotoMonthCatalog {
  if (
    !index.periods.some(
      (candidate) => candidate.month === period.month && candidate.path === period.path,
    )
  ) {
    throw new PhotoCatalogError(`月份 ${period.month} 不属于主 Catalog`);
  }
  if (period.month !== shard.month || period.count !== shard.photos.length) {
    throw new PhotoCatalogError(`月份索引 ${period.path} 与主 Catalog 不一致`);
  }

  const actualAlbumCounts = photoAlbumCounts(shard.photos);
  if (!sameCounts(actualAlbumCounts, period.albumCounts)) {
    throw new PhotoCatalogError(`月份索引 ${period.path} 的相册计数与主 Catalog 不一致`);
  }

  const albumIds = new Set(index.albums.map((album) => album.id));
  for (const photo of shard.photos) {
    for (const albumId of photo.albumIds) {
      if (!albumIds.has(albumId)) {
        throw new PhotoCatalogError(`照片 ${photo.id} 引用了不存在的相册 ${albumId}`);
      }
    }
    const locatedMonth = index.photoMonths[photo.id];
    if (locatedMonth !== shard.month) {
      throw new PhotoCatalogError(`照片 ${photo.id} 的定位月份与月份 Catalog 不一致`);
    }
  }
  return shard;
}

export function locatePhotoPeriod(index: PhotoCatalogIndex, photoId: string): PhotoPeriod | null {
  const month = index.photoMonths[photoId];
  return month ? (index.periods.find((period) => period.month === month) ?? null) : null;
}

export function photoAlbumCounts(photos: PhotoRecord[]): Record<string, number> {
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

function sameCounts(left: Record<string, number>, right: Record<string, number>): boolean {
  const entries = Object.entries(left);
  return (
    entries.length === Object.keys(right).length &&
    entries.every(([albumId, count]) => right[albumId] === count)
  );
}

export function catalogIndexUrl(baseUrl: string): string {
  return photoObjectUrl(baseUrl, PHOTO_CATALOG_INDEX_KEY);
}

export function photoObjectUrl(baseUrl: string, key: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedKey = key.replace(/^\/+/, "");
  return `${normalizedBaseUrl}/${normalizedKey}`;
}

export function photoVariantUrl(
  baseUrl: string,
  photoId: string,
  width: PhotoVariantWidth,
): string {
  return photoObjectUrl(baseUrl, `media/${photoId}/${width}.webp`);
}

export function photoVariantSrcSet(
  baseUrl: string,
  photoId: string,
  widths: readonly PhotoVariantWidth[] = PHOTO_VARIANT_WIDTHS,
): string {
  return widths.map((width) => `${photoVariantUrl(baseUrl, photoId, width)} ${width}w`).join(", ");
}
