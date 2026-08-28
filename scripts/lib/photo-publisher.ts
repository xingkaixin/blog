import { randomBytes } from "node:crypto";
import path from "node:path";
import { photoMediaObjectKey } from "../../src/lib/photo-artifact";
import {
  PHOTO_VARIANT_WIDTHS,
  isPhotoAlbumId,
  parsePhotoRecord,
  type PhotoRecord,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import { editPhotoCatalog, PhotoCatalogEditor } from "./photo-catalog-store";
import { collectPhotoGarbageBestEffort } from "./photo-garbage-collector";
import type { ProcessedPhoto } from "./photo-source";
import { hashPhotoFile, snapshotPhotoFile } from "./photo-source";
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

type IdentifiedFile = { file: string; id: string };

export async function publishPhotos(options: PublishPhotosOptions): Promise<PublishPhotosResult> {
  validateAlbum(options.album);
  const identifiedFiles = await mapWithConcurrency(
    options.files,
    READ_CONCURRENCY,
    async (file) => ({ file, id: await hashPhotoFile(file) }),
  );
  const uniqueFiles = uniqueFilesByContent(identifiedFiles);
  const preparedPhotos = new Map<string, PhotoRecord>();
  const { completed, ...result } = await editPhotoCatalog(
    options.store,
    (catalog) => publishPhotosOnce(options, catalog, identifiedFiles, preparedPhotos),
    async (store) => {
      const catalog = await PhotoCatalogEditor.load(store);
      applyAlbum(catalog, options.album);
      const published = await catalog.inspectPhotos(uniqueFiles.map((file) => file.id));
      const pending = uniqueFiles.filter((file) => !published.get(file.id));
      await mapWithConcurrency(pending, PROCESS_CONCURRENCY, async (identified, index) => {
        options.onProgress?.({
          type: "processing",
          file: identified.file,
          index: index + 1,
          total: pending.length,
        });
        const snapshot = await snapshotPhotoFile(identified.file);
        try {
          if (snapshot.id !== identified.id) {
            throw new Error(`照片源文件在识别后发生变化，请重新发布: ${identified.file}`);
          }
          const photo = await options.processPhoto(snapshot.source, identified.id);
          if (photo.id !== identified.id) {
            throw new Error(`照片处理器返回了错误的内容 ID: ${photo.id}`);
          }
          const record = createPhotoRecord(photo, options.album?.id);
          await uploadPhotoAssets(store, record, photo.variants);
          preparedPhotos.set(record.id, record);
        } finally {
          await snapshot.dispose();
        }
      });
    },
  );
  await collectPhotoGarbageBestEffort(options, options.onWarning);
  for (const progress of completed) {
    options.onProgress?.(progress);
  }
  return result;
}

async function publishPhotosOnce(
  options: PublishPhotosOptions,
  catalog: PhotoCatalogEditor,
  identifiedFiles: IdentifiedFile[],
  preparedPhotos: Map<string, PhotoRecord>,
): Promise<PublishPhotosResult & { completed: PublishProgress[] }> {
  const uniqueFiles = uniqueFilesByContent(identifiedFiles);
  const photoStatuses = await catalog.inspectPhotos(uniqueFiles.map((file) => file.id));
  applyAlbum(catalog, options.album);
  const pending: PhotoRecord[] = [];
  const completed: PublishProgress[] = [];
  for (const identified of uniqueFiles) {
    if (photoStatuses.get(identified.id)) {
      completed.push({ type: "reused", file: identified.file });
      if (options.album) {
        await catalog.addPhotoToAlbum(identified.id, options.album.id);
      }
    } else {
      const photo = preparedPhotos.get(identified.id);
      if (!photo) {
        throw new Error(`照片 ${identified.id} 在准备期间被移除，请重新发布`);
      }
      pending.push(photo);
      completed.push({ type: "published", file: identified.file, photoId: photo.id });
    }
  }
  await catalog.addPhotos(pending);
  const { catalogChanged, updatedPeriods } = await catalog.commit(options.now?.() ?? new Date());
  return {
    completed,
    discovered: identifiedFiles.length,
    published: pending.length,
    reused: identifiedFiles.length - pending.length,
    updatedPeriods,
    catalogChanged,
  };
}

function createPhotoRecord(photo: ProcessedPhoto, albumId: string | undefined): PhotoRecord {
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
  variants: ProcessedPhoto["variants"],
): Promise<void> {
  await mapWithConcurrency(PHOTO_VARIANT_WIDTHS, PROCESS_CONCURRENCY, async (width) => {
    const body = variants.get(width);
    if (!body) {
      throw new Error(`照片 ${photo.id} 缺少 ${width}px 版本`);
    }
    await store.put(photoMediaObjectKey(photo.id, width, photo.mediaRevision), body, {
      contentType: "image/webp",
      cacheControl: ASSET_CACHE_CONTROL,
      expectedVersion: null,
    });
  });
}

export function photoDisplayName(file: string): string {
  return path.basename(file);
}
