import path from "node:path";
import {
  PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
  PHOTO_VARIANT_WIDTHS,
  isPhotoAlbumId,
  monthFromCapturedAt,
  parsePhotoRecord,
  type PhotoAlbum,
  type PhotoRecord,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import {
  loadPhotoCatalog,
  loadPhotoCatalogMonths,
  retryPhotoCatalogMutation,
  writePhotoCatalog,
  writePhotoCatalogIndex,
  type LoadedPhotoCatalog,
} from "./photo-catalog-store";
import { collectPhotoGarbageBestEffort } from "./photo-garbage-collector";
import { hasUnreferencedPhotoArtifacts, isPhotoArtifactDeletionClaimed } from "./photo-retirement";
import type { ProcessedPhoto } from "./photo-source";
import { snapshotPhotoFile, type PhotoSourceSnapshot } from "./photo-source";
import type { PhotoObjectStore } from "./photo-store";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
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
  onWarning?: (message: string) => void;
};

export type PublishPhotosResult = {
  discovered: number;
  published: number;
  reused: number;
  updatedPeriods: number;
  catalogChanged: boolean;
};

type IdentifiedFile = PhotoSourceSnapshot;

export async function publishPhotos(options: PublishPhotosOptions): Promise<PublishPhotosResult> {
  validateAlbum(options.album);
  const now = options.now?.() ?? new Date();
  const identifiedFiles = await identifyFiles(options.files);
  const publishedPhotos = new Map<string, PhotoRecord>();
  const attemptedArtifacts = new Set<string>();
  const writtenArtifacts = new Set<string>();
  try {
    await collectPhotoGarbageBestEffort(
      { store: options.store, now: () => now },
      options.onWarning,
    );
    try {
      return await retryPhotoCatalogMutation(() =>
        publishPhotosOnce(
          { ...options, now: () => now },
          identifiedFiles,
          publishedPhotos,
          attemptedArtifacts,
          writtenArtifacts,
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
  publishedPhotos: Map<string, PhotoRecord>,
  attemptedArtifacts: Set<string>,
  writtenArtifacts: Set<string>,
): Promise<PublishPhotosResult> {
  const uniqueFiles = uniqueFilesByContent(identifiedFiles);
  const catalog = await loadPhotoCatalog(options.store);
  await loadPhotoCatalogMonths(
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
      const published = publishedPhotos.get(identified.id);
      if (published) {
        assertPhotoAssetsWritable(catalog, published.id);
        return published;
      }
      options.onProgress?.({
        type: "processing",
        file: identified.file,
        index: index + 1,
        total: pending.length,
      });
      const photo = await options.processPhoto(identified.source, identified.id);
      if (photo.id !== identified.id) {
        throw new Error(`照片处理器返回了错误的内容 ID: ${photo.id}`);
      }
      const record = validateNewPhoto(photo, options.album?.id);
      await uploadPhotoAssets(options.store, catalog, photo, attemptedArtifacts, writtenArtifacts);
      publishedPhotos.set(photo.id, record);
      options.onProgress?.({
        type: "published",
        file: identified.file,
        photoId: photo.id,
      });
      return record;
    },
  );

  await loadPhotoCatalogMonths(
    options.store,
    catalog,
    processed.map((record) => monthFromCapturedAt(record.capturedAt)),
  );

  for (const record of processed) {
    const month = monthFromCapturedAt(record.capturedAt);
    const monthCatalog = catalog.months.get(month) ?? {
      schemaVersion: PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
      month,
      photos: [],
    };
    monthCatalog.photos.push(record);
    catalog.months.set(month, monthCatalog);
    catalog.photoMonths.set(record.id, month);
    dirtyMonths.add(month);
  }

  const domainChanged =
    albumChanged ||
    dirtyMonths.size > 0 ||
    hasUnreferencedPhotoArtifacts(catalog, catalog.periods, attemptedArtifacts);
  const catalogChanged = domainChanged || !catalog.publicIndexCurrent;
  if (domainChanged) {
    await writePhotoCatalog(
      options.store,
      catalog,
      dirtyMonths,
      options.now?.() ?? new Date(),
      attemptedArtifacts,
      writtenArtifacts,
    );
  } else if (!catalog.publicIndexCurrent) {
    await writePhotoCatalogIndex(options.store, catalog);
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
  catalog: LoadedPhotoCatalog,
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
  catalog: LoadedPhotoCatalog,
  photo: ProcessedPhoto,
  attemptedArtifacts: Set<string>,
  writtenArtifacts: Set<string>,
): Promise<void> {
  assertPhotoAssetsWritable(catalog, photo.id);
  await mapWithConcurrency(PHOTO_VARIANT_WIDTHS, PROCESS_CONCURRENCY, async (width) => {
    const body = photo.variants.get(width);
    if (!body) {
      throw new Error(`照片 ${photo.id} 缺少 ${width}px 版本`);
    }
    const key = `media/${photo.id}/${width}.webp`;
    if (writtenArtifacts.has(key)) {
      return;
    }
    attemptedArtifacts.add(key);
    await store.put(key, body, {
      contentType: "image/webp",
      cacheControl: ASSET_CACHE_CONTROL,
    });
    writtenArtifacts.add(key);
  });
}

function assertPhotoAssetsWritable(catalog: LoadedPhotoCatalog, photoId: string): void {
  const claimedKey = PHOTO_VARIANT_WIDTHS.map((width) => `media/${photoId}/${width}.webp`).find(
    (key) => isPhotoArtifactDeletionClaimed(catalog, key),
  );
  if (claimedKey) {
    throw new Error(`照片对象 ${claimedKey} 正在回收，请稍后重试`);
  }
}

async function recordFailedPublishArtifacts(
  store: PhotoObjectStore,
  attemptedArtifacts: Set<string>,
  failedAt: Date,
): Promise<void> {
  if (attemptedArtifacts.size === 0) {
    return;
  }
  await retryPhotoCatalogMutation(async () => {
    const catalog = await loadPhotoCatalog(store);
    if (!hasUnreferencedPhotoArtifacts(catalog, catalog.periods, attemptedArtifacts)) {
      return;
    }
    await writePhotoCatalog(store, catalog, new Set(), failedAt, attemptedArtifacts);
  });
}

export function photoDisplayName(file: string): string {
  return path.basename(file);
}
