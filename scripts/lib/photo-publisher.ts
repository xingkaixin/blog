import { randomBytes } from "node:crypto";
import path from "node:path";
import {
  PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
  PHOTO_VARIANT_WIDTHS,
  isPhotoAlbumId,
  isPhotoId,
  monthFromCapturedAt,
  parsePhotoRecord,
  type PhotoAlbum,
  type PhotoRecord,
  type RetiredArtifactBatch,
  type RetiredPhotoObjects,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import {
  loadPhotoCatalog,
  loadPhotoCatalogMonths,
  retryPhotoCatalogMutation,
  writePhotoCatalog,
  type LoadedPhotoCatalog,
} from "./photo-catalog-store";
import {
  hasUnreferencedPhotoArtifacts,
  isPhotoArtifactDeletionClaimed,
  photoRetirementDeadline,
} from "./photo-retirement";
import type { ProcessedPhoto } from "./photo-source";
import { snapshotPhotoFile, type PhotoSourceSnapshot } from "./photo-source";
import type { PhotoObjectStore } from "./photo-store";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const PROCESS_CONCURRENCY = 2;
const READ_CONCURRENCY = 8;
const GARBAGE_CLAIM_DURATION_MS = 60 * 60 * 1_000;
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

export type DeletePhotosOptions = {
  photoIds: string[];
  store: PhotoObjectStore;
  now?: () => Date;
  onWarning?: (message: string) => void;
};

export type DeletePhotosResult = {
  deleted: number;
  alreadyRetired: number;
  retiredObjects: number;
  updatedPeriods: number;
};

export type CollectPhotoGarbageOptions = {
  store: PhotoObjectStore;
  now?: () => Date;
};

export type CollectPhotoGarbageResult = {
  removedObjects: number;
  failedObjects: number;
  pendingPhotos: number;
  pendingArtifacts: number;
  failures: PhotoGarbageFailure[];
};

export type PhotoGarbageFailure = {
  objectKey: string;
  message: string;
};

type GarbageDeletionResult = { status: "removed" } | { status: "failed"; message: string };

type GarbageClaim = {
  id: string;
  photos: RetiredPhotoObjects[];
  artifacts: RetiredArtifactBatch[];
  pendingPhotos: number;
  pendingArtifacts: number;
};

type IdentifiedFile = PhotoSourceSnapshot;

export async function publishPhotos(options: PublishPhotosOptions): Promise<PublishPhotosResult> {
  validateAlbum(options.album);
  const now = options.now?.() ?? new Date();
  const identifiedFiles = await identifyFiles(options.files);
  const processedPhotos = new Map<string, ProcessedPhoto>();
  const attemptedArtifacts = new Set<string>();
  try {
    reportGarbageFailures(
      await collectPhotoGarbage({ store: options.store, now: () => now }),
      options.onWarning,
    );
    try {
      return await retryPhotoCatalogMutation(() =>
        publishPhotosOnce(
          { ...options, now: () => now },
          identifiedFiles,
          processedPhotos,
          attemptedArtifacts,
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
  processedPhotos: Map<string, ProcessedPhoto>,
  attemptedArtifacts: Set<string>,
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
      let photo = processedPhotos.get(identified.id);
      if (!photo) {
        options.onProgress?.({
          type: "processing",
          file: identified.file,
          index: index + 1,
          total: pending.length,
        });
        photo = await options.processPhoto(identified.source, identified.id);
      }
      if (photo.id !== identified.id) {
        throw new Error(`照片处理器返回了错误的内容 ID: ${photo.id}`);
      }
      processedPhotos.set(photo.id, photo);
      const record = validateNewPhoto(photo, options.album?.id);
      return { file: identified.file, photo, record };
    },
  );

  await loadPhotoCatalogMonths(
    options.store,
    catalog,
    processed.map(({ record }) => monthFromCapturedAt(record.capturedAt)),
  );
  await mapWithConcurrency(processed, PROCESS_CONCURRENCY, async ({ file, photo }) => {
    await uploadPhotoAssets(options.store, catalog, photo, attemptedArtifacts);
    options.onProgress?.({
      type: "published",
      file,
      photoId: photo.id,
    });
  });

  for (const { record } of processed) {
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

  const catalogChanged =
    albumChanged ||
    dirtyMonths.size > 0 ||
    hasUnreferencedPhotoArtifacts(catalog, catalog.periods, attemptedArtifacts);
  if (catalogChanged) {
    await writePhotoCatalog(
      options.store,
      catalog,
      dirtyMonths,
      options.now?.() ?? new Date(),
      attemptedArtifacts,
    );
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
  const now = options.now?.() ?? new Date();
  const result = await retryPhotoCatalogMutation(() =>
    deletePhotosOnce({ ...options, now: () => now }),
  );
  reportGarbageFailures(
    await collectPhotoGarbage({ store: options.store, now: () => now }),
    options.onWarning,
  );
  return result;
}

async function deletePhotosOnce(options: DeletePhotosOptions): Promise<DeletePhotosResult> {
  const photoIds = [...new Set(options.photoIds)];
  if (photoIds.length === 0) {
    throw new Error("至少需要指定一张照片");
  }
  if (photoIds.some((photoId) => !isPhotoId(photoId))) {
    throw new Error("照片 ID 必须是 32 位小写十六进制内容 ID");
  }

  const catalog = await loadPhotoCatalog(options.store);
  const alreadyRetired = photoIds.filter((photoId) => catalog.retiredObjects.has(photoId));
  const activePhotoIds = photoIds.filter((photoId) => !catalog.retiredObjects.has(photoId));
  await loadPhotoCatalogMonths(
    options.store,
    catalog,
    activePhotoIds.flatMap((photoId) => catalog.photoMonths.get(photoId) ?? []),
  );
  const targets = activePhotoIds.map((photoId) => {
    const month = catalog.photoMonths.get(photoId);
    const photo = month
      ? catalog.months.get(month)?.photos.find((item) => item.id === photoId)
      : null;
    if (!month || !photo) {
      throw new Error(`Catalog 中不存在照片 ${photoId}`);
    }
    return { month, photo };
  });
  const dirtyMonths = new Set(targets.map(({ month }) => month));

  if (targets.length === 0) {
    return {
      deleted: 0,
      alreadyRetired: alreadyRetired.length,
      retiredObjects: 0,
      updatedPeriods: 0,
    };
  }

  for (const { month, photo } of targets) {
    const monthCatalog = catalog.months.get(month);
    if (!monthCatalog) {
      throw new Error(`缺少照片 ${photo.id} 所属月份 ${month}`);
    }
    monthCatalog.photos = monthCatalog.photos.filter((item) => item.id !== photo.id);
    catalog.photoMonths.delete(photo.id);
  }
  const deleteAfter = photoRetirementDeadline(options.now?.() ?? new Date());
  const objectKeys = new Set<string>();
  for (const { month, photo } of targets) {
    const photoObjectKeys = new Set<string>();
    const oldPeriodPath = catalog.periods.get(month)?.path;
    if (oldPeriodPath) {
      objectKeys.add(oldPeriodPath);
    }
    for (const width of PHOTO_VARIANT_WIDTHS) {
      photoObjectKeys.add(`media/${photo.id}/${width}.webp`);
    }
    const retired: RetiredPhotoObjects = {
      photoId: photo.id,
      objectKeys: [...photoObjectKeys].toSorted(),
      deleteAfter,
    };
    catalog.retiredObjects.set(photo.id, retired);
    for (const key of photoObjectKeys) {
      objectKeys.add(key);
    }
  }
  await writePhotoCatalog(options.store, catalog, dirtyMonths, options.now?.() ?? new Date());

  return {
    deleted: activePhotoIds.length,
    alreadyRetired: alreadyRetired.length,
    retiredObjects: objectKeys.size,
    updatedPeriods: dirtyMonths.size,
  };
}

export async function collectPhotoGarbage(
  options: CollectPhotoGarbageOptions,
): Promise<CollectPhotoGarbageResult> {
  const now = options.now?.() ?? new Date();
  const claimId = randomBytes(12).toString("hex");
  const claim = await retryPhotoCatalogMutation(() =>
    claimPhotoGarbage({ ...options, now: () => now }, claimId),
  );
  if (claim.photos.length === 0 && claim.artifacts.length === 0) {
    return {
      removedObjects: 0,
      failedObjects: 0,
      pendingPhotos: claim.pendingPhotos,
      pendingArtifacts: claim.pendingArtifacts,
      failures: [],
    };
  }

  const objectKeys = [
    ...new Set([
      ...claim.photos.flatMap((entry) => entry.objectKeys),
      ...claim.artifacts.flatMap((entry) => entry.objectKeys),
    ]),
  ];
  const deletionResults = new Map<string, GarbageDeletionResult>(
    await mapWithConcurrency(
      objectKeys,
      READ_CONCURRENCY,
      async (key): Promise<[string, GarbageDeletionResult]> => {
        try {
          await options.store.delete(key);
          return [key, { status: "removed" }];
        } catch (error) {
          return [
            key,
            {
              status: "failed",
              message: error instanceof Error ? error.message : String(error),
            },
          ];
        }
      },
    ),
  );
  return retryPhotoCatalogMutation(() =>
    finishPhotoGarbageCollection(options.store, claim, deletionResults, now),
  );
}

async function claimPhotoGarbage(
  options: CollectPhotoGarbageOptions,
  claimId: string,
): Promise<GarbageClaim> {
  const now = options.now?.() ?? new Date();
  const catalog = await loadPhotoCatalog(options.store);
  const expiresAt = new Date(now.getTime() + GARBAGE_CLAIM_DURATION_MS).toISOString();
  const canClaim = (entry: RetiredPhotoObjects | RetiredArtifactBatch) =>
    Date.parse(entry.deleteAfter) <= now.getTime() &&
    (entry.deletion === undefined ||
      entry.deletion.id === claimId ||
      Date.parse(entry.deletion.expiresAt) <= now.getTime());
  const photos = [...catalog.retiredObjects.values()].filter(canClaim);
  const artifacts = [...catalog.retiredArtifacts.values()].filter(canClaim);
  for (const entry of [...photos, ...artifacts]) {
    entry.deletion = { id: claimId, expiresAt };
  }
  if (photos.length > 0 || artifacts.length > 0) {
    await writePhotoCatalog(options.store, catalog, new Set(), now);
  }
  return {
    id: claimId,
    photos,
    artifacts,
    pendingPhotos: catalog.retiredObjects.size,
    pendingArtifacts: catalog.retiredArtifacts.size,
  };
}

async function finishPhotoGarbageCollection(
  store: PhotoObjectStore,
  claim: GarbageClaim,
  deletionResults: Map<string, GarbageDeletionResult>,
  now: Date,
): Promise<CollectPhotoGarbageResult> {
  const catalog = await loadPhotoCatalog(store);
  finishClaimedEntries(
    claim.photos,
    catalog.retiredObjects,
    (entry) => entry.photoId,
    claim.id,
    deletionResults,
  );
  finishClaimedEntries(
    claim.artifacts,
    catalog.retiredArtifacts,
    (entry) => entry.retirementId,
    claim.id,
    deletionResults,
  );
  await writePhotoCatalog(store, catalog, new Set(), now);
  const failures: PhotoGarbageFailure[] = [];
  for (const [objectKey, result] of deletionResults) {
    if (result.status === "failed") {
      failures.push({ objectKey, message: result.message });
    }
  }

  return {
    removedObjects: [...deletionResults.values()].filter((result) => result.status === "removed")
      .length,
    failedObjects: failures.length,
    pendingPhotos: catalog.retiredObjects.size,
    pendingArtifacts: catalog.retiredArtifacts.size,
    failures,
  };
}

function finishClaimedEntries<Entry extends RetiredPhotoObjects | RetiredArtifactBatch>(
  claimedEntries: Entry[],
  currentEntries: Map<string, Entry>,
  entryId: (entry: Entry) => string,
  claimId: string,
  deletionResults: Map<string, GarbageDeletionResult>,
): void {
  for (const claimed of claimedEntries) {
    const id = entryId(claimed);
    const current = currentEntries.get(id);
    if (current?.deletion?.id !== claimId) {
      continue;
    }
    const failedKeys = current.objectKeys.filter(
      (key) => deletionResults.get(key)?.status === "failed",
    );
    if (failedKeys.length === 0) {
      currentEntries.delete(id);
    } else {
      currentEntries.set(id, { ...current, objectKeys: failedKeys, deletion: undefined });
    }
  }
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
): Promise<void> {
  const objectKeys = PHOTO_VARIANT_WIDTHS.map((width) => `media/${photo.id}/${width}.webp`);
  const claimedKey = objectKeys.find((key) => isPhotoArtifactDeletionClaimed(catalog, key));
  if (claimedKey) {
    throw new Error(`照片对象 ${claimedKey} 正在回收，请稍后重试`);
  }
  await mapWithConcurrency(PHOTO_VARIANT_WIDTHS, PROCESS_CONCURRENCY, async (width) => {
    const body = photo.variants.get(width);
    if (!body) {
      throw new Error(`照片 ${photo.id} 缺少 ${width}px 版本`);
    }
    const key = `media/${photo.id}/${width}.webp`;
    attemptedArtifacts.add(key);
    await store.put(key, body, {
      contentType: "image/webp",
      cacheControl: ASSET_CACHE_CONTROL,
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
  await retryPhotoCatalogMutation(async () => {
    const catalog = await loadPhotoCatalog(store);
    if (!hasUnreferencedPhotoArtifacts(catalog, catalog.periods, attemptedArtifacts)) {
      return;
    }
    await writePhotoCatalog(store, catalog, new Set(), failedAt, attemptedArtifacts);
  });
}

function reportGarbageFailures(
  result: CollectPhotoGarbageResult,
  warn: (message: string) => void = console.warn,
): void {
  for (const failure of result.failures) {
    warn(`照片对象回收失败 ${failure.objectKey}: ${failure.message}`);
  }
}

export function photoDisplayName(file: string): string {
  return path.basename(file);
}
