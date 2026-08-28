import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { photoMediaObjectKey } from "../../src/lib/photo-artifact";
import {
  PHOTO_VARIANT_WIDTHS,
  isPhotoAlbumId,
  parsePhotoRecord,
  type PhotoRecord,
  type PhotoVariantWidth,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import { editPhotoCatalog, type PhotoCatalogEditor } from "./photo-catalog-store";
import { collectPhotoGarbageBestEffort } from "./photo-garbage-collector";
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
type PreparedPhoto = Omit<ProcessedPhoto, "variants"> & {
  variants: Map<PhotoVariantWidth, string>;
};

export async function publishPhotos(options: PublishPhotosOptions): Promise<PublishPhotosResult> {
  validateAlbum(options.album);
  const identifiedFiles = await identifyFiles(options.files);
  const attemptedArtifacts = new Set<string>();
  const preparedPhotos = new Map<string, PreparedPhoto>();
  try {
    await collectPhotoGarbageBestEffort(options, options.onWarning);
    const { completed, ...result } = await editPhotoCatalog(options.store, (catalog) =>
      publishPhotosOnce(options, catalog, identifiedFiles, attemptedArtifacts, preparedPhotos),
    ).catch(async (error: unknown) => {
      try {
        await recordFailedPublishArtifacts(
          options.store,
          attemptedArtifacts,
          options.now?.() ?? new Date(),
        );
      } catch (retirementError) {
        const failure = new AggregateError(
          [error, retirementError],
          "照片发布失败，且无法记录已写入的待回收产物",
        );
        throw failure;
      }
      throw error;
    });
    for (const progress of completed) {
      options.onProgress?.(progress);
    }
    return result;
  } finally {
    await Promise.all(identifiedFiles.map((file) => file.dispose()));
    await collectPhotoGarbageBestEffort(options, options.onWarning);
  }
}

async function publishPhotosOnce(
  options: PublishPhotosOptions,
  catalog: PhotoCatalogEditor,
  identifiedFiles: IdentifiedFile[],
  attemptedArtifacts: Set<string>,
  preparedPhotos: Map<string, PreparedPhoto>,
): Promise<PublishPhotosResult & { completed: PublishProgress[] }> {
  const uniqueFiles = uniqueFilesByContent(identifiedFiles);
  const photoStatuses = await catalog.inspectPhotos(uniqueFiles.map((file) => file.id));
  applyAlbum(catalog, options.album);
  const pending: IdentifiedFile[] = [];
  const completed: PublishProgress[] = [];
  let reused = identifiedFiles.length - uniqueFiles.length;

  for (const identified of uniqueFiles) {
    const status = photoStatuses.get(identified.id);
    if (!status) {
      pending.push(identified);
      continue;
    }

    reused += 1;
    completed.push({ type: "reused", file: identified.file });
    if (options.album) {
      await catalog.addPhotoToAlbum(identified.id, options.album.id);
    }
  }

  const processed = await mapWithConcurrency(
    pending,
    PROCESS_CONCURRENCY,
    async (identified, index) => {
      let photo = preparedPhotos.get(identified.id);
      if (!photo) {
        options.onProgress?.({
          type: "processing",
          file: identified.file,
          index: index + 1,
          total: pending.length,
        });
        photo = await preparePhoto(identified, options.processPhoto);
        preparedPhotos.set(identified.id, photo);
      }
      const record = createPhotoRecord(photo, options.album?.id);
      await uploadPhotoAssets(options.store, record, photo.variants, attemptedArtifacts);
      completed.push({
        type: "published",
        file: identified.file,
        photoId: photo.id,
      });
      return record;
    },
  );

  await catalog.addPhotos(processed);
  const { catalogChanged, updatedPeriods } = await catalog.commit(
    options.now?.() ?? new Date(),
    attemptedArtifacts,
  );

  return {
    completed,
    discovered: identifiedFiles.length,
    published: processed.length,
    reused,
    updatedPeriods,
    catalogChanged,
  };
}

async function preparePhoto(
  identified: IdentifiedFile,
  processPhoto: PublishPhotosOptions["processPhoto"],
): Promise<PreparedPhoto> {
  const { variants, ...photo } = await processPhoto(identified.source, identified.id);
  if (photo.id !== identified.id) {
    throw new Error(`照片处理器返回了错误的内容 ID: ${photo.id}`);
  }
  // 复用源快照的临时目录，让重试缓存随发布结束清理，避免整批图片常驻内存。
  const files = await mapWithConcurrency(
    PHOTO_VARIANT_WIDTHS,
    PROCESS_CONCURRENCY,
    async (width): Promise<[PhotoVariantWidth, string]> => {
      const body = variants.get(width);
      if (!body) {
        throw new Error(`照片 ${photo.id} 缺少 ${width}px 版本`);
      }
      const file = path.join(path.dirname(identified.source), `${width}.webp`);
      await fs.writeFile(file, body);
      return [width, file];
    },
  );
  return { ...photo, variants: new Map(files) };
}

function createPhotoRecord(photo: PreparedPhoto, albumId: string | undefined): PhotoRecord {
  return parsePhotoRecord({
    id: photo.id,
    mediaRevision: randomBytes(12).toString("hex"),
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

function applyAlbum(catalog: PhotoCatalogEditor, album: PublishAlbum | undefined): boolean {
  if (!album) {
    return false;
  }

  const existing = catalog.album(album.id);
  if (!existing) {
    if (!album.title) {
      throw new Error(`新相册 ${album.id} 必须同时提供 --album-title`);
    }
    return catalog.upsertAlbum({ id: album.id, title: album.title.trim() });
  }

  if (album.title && existing.title !== album.title.trim()) {
    return catalog.upsertAlbum({ id: album.id, title: album.title.trim() });
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

async function uploadPhotoAssets(
  store: PhotoObjectStore,
  photo: PhotoRecord,
  variants: PreparedPhoto["variants"],
  attemptedArtifacts: Set<string>,
): Promise<void> {
  await mapWithConcurrency(PHOTO_VARIANT_WIDTHS, PROCESS_CONCURRENCY, async (width) => {
    const file = variants.get(width);
    if (!file) {
      throw new Error(`照片 ${photo.id} 缺少 ${width}px 版本`);
    }
    const key = photoMediaObjectKey(photo.id, width, photo.mediaRevision);
    const body = await fs.readFile(file);
    attemptedArtifacts.add(key);
    await store.put(key, body, {
      contentType: "image/webp",
      cacheControl: ASSET_CACHE_CONTROL,
      expectedVersion: null,
    });
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
  await editPhotoCatalog(store, async (catalog) => {
    await catalog.commit(failedAt, attemptedArtifacts);
  });
}

export function photoDisplayName(file: string): string {
  return path.basename(file);
}
