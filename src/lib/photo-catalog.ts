import {
  PHOTO_VARIANT_WIDTHS,
  isPhotoId,
  isPhotoMonth,
  monthFromPhotoMonthCatalogObjectKey,
  photoMediaObjectKey,
  type PhotoVariantWidth,
} from "./photo-artifact";
import { isPhotoTimestamp } from "./photo-timestamp";

export { PHOTO_VARIANT_WIDTHS, isPhotoId } from "./photo-artifact";
export type { PhotoVariantWidth } from "./photo-artifact";

export const PHOTO_CATALOG_INDEX_SCHEMA_VERSION = 3 as const;
export const PHOTO_MONTH_CATALOG_SCHEMA_VERSION = 1 as const;
export const PHOTO_THUMBNAIL_WIDTH = PHOTO_VARIANT_WIDTHS[0];
export const PHOTO_DISPLAY_WIDTH = PHOTO_VARIANT_WIDTHS[1];
export const PHOTO_FULL_WIDTH = PHOTO_VARIANT_WIDTHS[2];
export const PHOTO_CATALOG_INDEX_KEY = "catalog/index.json";

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

export type PhotoCatalogContents = {
  generatedAt: string;
  albums: PhotoAlbum[];
  periods: PhotoPeriod[];
  photoMonths: Record<string, string>;
};

export type PhotoCatalogIndex = PhotoCatalogContents & {
  schemaVersion: typeof PHOTO_CATALOG_INDEX_SCHEMA_VERSION;
};

export type PhotoMonthCatalog = {
  schemaVersion: typeof PHOTO_MONTH_CATALOG_SCHEMA_VERSION;
  month: string;
  photos: PhotoRecord[];
};

const ALBUM_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const COLOR_PATTERN = /^#[a-f0-9]{6}$/;
const MAX_IMAGE_DIMENSION = 100_000;
const LEGACY_PHOTO_CATALOG_INDEX_SCHEMA_VERSIONS = [1, 2] as const;

export type PhotoCatalogIndexSourceVersion =
  | typeof PHOTO_CATALOG_INDEX_SCHEMA_VERSION
  | (typeof LEGACY_PHOTO_CATALOG_INDEX_SCHEMA_VERSIONS)[number];

export type ParsedPhotoCatalogIndex = {
  index: PhotoCatalogIndex;
  sourceVersion: PhotoCatalogIndexSourceVersion;
};

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} 必须是字符串`);
  }
  return value;
}

function readInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${field} 必须是 ${minimum} 到 ${maximum} 之间的整数`);
  }
  return value as number;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} 必须是数组`);
  }
  return value.map((item, index) => readString(item, `${field}[${index}]`));
}

function assertUnique(values: string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${field} 不能包含重复值`);
  }
}

function readTimestamp(value: unknown, field: string): string {
  const timestamp = readString(value, field);
  if (!isPhotoTimestamp(timestamp)) {
    throw new Error(`${field} 必须是包含时区的 ISO 时间`);
  }
  return timestamp;
}

function readMonth(value: unknown, field: string): string {
  const month = readString(value, field);
  if (!isPhotoMonth(month)) {
    throw new Error(`${field} 必须是 YYYY-MM`);
  }
  return month;
}

function readAlbum(value: unknown, field: string): PhotoAlbum {
  const album = readRecord(value, field);
  const id = readString(album.id, `${field}.id`);
  const title = readString(album.title, `${field}.title`).trim();

  if (!isPhotoAlbumId(id)) {
    throw new Error(`${field}.id 只能包含小写字母、数字和连字符`);
  }
  if (title.length === 0 || title.length > 80) {
    throw new Error(`${field}.title 长度必须在 1 到 80 之间`);
  }

  return { id, title };
}

function readAlbumCounts(value: unknown, field: string, count: number): Record<string, number> {
  const input = readRecord(value, field);
  const output: Record<string, number> = {};

  for (const [albumId, albumCount] of Object.entries(input)) {
    if (!isPhotoAlbumId(albumId)) {
      throw new Error(`${field} 包含无效的相册 ID`);
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

  if (monthFromPhotoMonthCatalogObjectKey(path) !== month) {
    throw new Error(`${field}.path 不是有效的月份索引路径`);
  }

  return {
    month,
    count,
    albumCounts: readAlbumCounts(period.albumCounts, `${field}.albumCounts`, count),
    path,
  };
}

function readPhotoMonths(value: unknown, field: string): Record<string, string> {
  const input = readRecord(value, field);
  const output: Record<string, string> = {};
  for (const [photoId, month] of Object.entries(input)) {
    if (!isPhotoId(photoId)) {
      throw new Error(`${field} 包含无效的照片 ID`);
    }
    output[photoId] = readMonth(month, `${field}.${photoId}`);
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
    throw new Error(`${field}.id 必须是 32 位十六进制内容 ID`);
  }
  if (!albumIds.every(isPhotoAlbumId)) {
    throw new Error(`${field}.albumIds 包含无效的相册 ID`);
  }
  assertUnique(albumIds, `${field}.albumIds`);
  if (!COLOR_PATTERN.test(placeholderColor)) {
    throw new Error(`${field}.placeholderColor 必须是小写十六进制颜色`);
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
      throw new Error(`${field} 必须按时间从新到旧排列`);
    }
  }
}

function assertPhotosNewestFirst(photos: PhotoRecord[]): void {
  for (let index = 1; index < photos.length; index += 1) {
    const previous = photos[index - 1];
    const current = photos[index];
    if (comparePhotosNewestFirst(previous, current) > 0) {
      throw new Error("monthCatalog.photos 必须按拍摄时间从新到旧排列");
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

export function monthFromCapturedAt(capturedAt: string): string {
  return capturedAt.slice(0, 7);
}

export function parsePhotoCatalogIndex(value: unknown): PhotoCatalogIndex {
  return parsePhotoCatalogIndexWithVersion(value).index;
}

export function parsePhotoCatalogIndexWithVersion(value: unknown): ParsedPhotoCatalogIndex {
  const input = readRecord(value, "catalog");
  if (!isPhotoCatalogIndexSourceVersion(input.schemaVersion)) {
    throw new Error("不支持的照片 Catalog 版本");
  }

  return {
    index: {
      schemaVersion: PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
      ...parsePhotoCatalogContents(input, "catalog"),
    },
    sourceVersion: input.schemaVersion,
  };
}

function isPhotoCatalogIndexSourceVersion(value: unknown): value is PhotoCatalogIndexSourceVersion {
  return (
    value === PHOTO_CATALOG_INDEX_SCHEMA_VERSION ||
    LEGACY_PHOTO_CATALOG_INDEX_SCHEMA_VERSIONS.some((version) => version === value)
  );
}

export function parsePhotoCatalogContents(value: unknown, field: string): PhotoCatalogContents {
  const input = readRecord(value, field);
  const generatedAt = readTimestamp(input.generatedAt, `${field}.generatedAt`);
  if (!Array.isArray(input.albums) || !Array.isArray(input.periods)) {
    throw new Error(`${field}.albums 和 ${field}.periods 必须是数组`);
  }

  const albums = input.albums.map((album, index) => readAlbum(album, `${field}.albums[${index}]`));
  const periods = input.periods.map((period, index) =>
    readPeriod(period, `${field}.periods[${index}]`),
  );
  const photoMonths = readPhotoMonths(input.photoMonths, `${field}.photoMonths`);

  assertUnique(
    albums.map((album) => album.id),
    `${field}.albums`,
  );
  assertUnique(
    periods.map((period) => period.month),
    `${field}.periods`,
  );
  assertNewestFirst(periods, (period) => period.month, `${field}.periods`);

  const albumIds = new Set(albums.map((album) => album.id));
  const periodMonths = new Set(periods.map((period) => period.month));
  for (const period of periods) {
    for (const albumId of Object.keys(period.albumCounts)) {
      if (!albumIds.has(albumId)) {
        throw new Error(`月份 ${period.month} 引用了不存在的相册 ${albumId}`);
      }
    }
  }
  for (const [photoId, month] of Object.entries(photoMonths)) {
    if (!periodMonths.has(month)) {
      throw new Error(`照片 ${photoId} 指向不存在的月份 ${month}`);
    }
  }
  const totalPhotoCount = periods.reduce((sum, period) => sum + period.count, 0);
  if (Object.keys(photoMonths).length !== totalPhotoCount) {
    throw new Error(`${field}.photoMonths 必须完整覆盖所有照片`);
  }

  return {
    generatedAt,
    albums,
    periods,
    photoMonths,
  };
}

export function parsePhotoMonthCatalog(value: unknown): PhotoMonthCatalog {
  const input = readRecord(value, "monthCatalog");
  if (input.schemaVersion !== PHOTO_MONTH_CATALOG_SCHEMA_VERSION) {
    throw new Error("不支持的照片月份 Catalog 版本");
  }
  if (!Array.isArray(input.photos)) {
    throw new Error("monthCatalog.photos 必须是数组");
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
      throw new Error(`照片 ${photo.id} 的拍摄月份与月份 Catalog 不一致`);
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
    throw new Error(`月份 ${period.month} 不属于主 Catalog`);
  }
  if (period.month !== shard.month || period.count !== shard.photos.length) {
    throw new Error(`月份索引 ${period.path} 与主 Catalog 不一致`);
  }

  const actualAlbumCounts = photoAlbumCounts(shard.photos);
  if (!sameCounts(actualAlbumCounts, period.albumCounts)) {
    throw new Error(`月份索引 ${period.path} 的相册计数与主 Catalog 不一致`);
  }

  const albumIds = new Set(index.albums.map((album) => album.id));
  for (const photo of shard.photos) {
    for (const albumId of photo.albumIds) {
      if (!albumIds.has(albumId)) {
        throw new Error(`照片 ${photo.id} 引用了不存在的相册 ${albumId}`);
      }
    }
    const locatedMonth = index.photoMonths[photo.id];
    if (locatedMonth !== shard.month) {
      throw new Error(`照片 ${photo.id} 的定位月份与月份 Catalog 不一致`);
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
  return photoObjectUrl(baseUrl, photoMediaObjectKey(photoId, width));
}

export function photoVariantSrcSet(
  baseUrl: string,
  photoId: string,
  widths: readonly PhotoVariantWidth[] = PHOTO_VARIANT_WIDTHS,
): string {
  return widths.map((width) => `${photoVariantUrl(baseUrl, photoId, width)} ${width}w`).join(", ");
}
