import { isPhotoId } from "../../src/lib/photo-catalog";
import { photoRetirementDeadline } from "./photo-catalog-state";
import {
  loadPhotoCatalog,
  loadPhotoCatalogMonths,
  retryPhotoCatalogMutation,
  writePhotoCatalog,
} from "./photo-catalog-store";
import { collectPhotoGarbageBestEffort } from "./photo-garbage-collector";
import type { PhotoObjectStore } from "./photo-store";

export type RetirePhotosOptions = {
  photoIds: string[];
  store: PhotoObjectStore;
  now?: () => Date;
  onWarning?: (message: string) => void;
};

export type RetirePhotosResult = {
  retired: number;
  alreadyRetired: number;
  retiredObjects: number;
  updatedPeriods: number;
};

export async function retirePhotos(options: RetirePhotosOptions): Promise<RetirePhotosResult> {
  const now = options.now?.() ?? new Date();
  const result = await retryPhotoCatalogMutation(() =>
    retirePhotosOnce({ ...options, now: () => now }),
  );
  await collectPhotoGarbageBestEffort({ store: options.store, now: () => now }, options.onWarning);
  return result;
}

async function retirePhotosOnce(options: RetirePhotosOptions): Promise<RetirePhotosResult> {
  const photoIds = [...new Set(options.photoIds)];
  if (photoIds.length === 0) {
    throw new Error("至少需要指定一张照片");
  }
  if (photoIds.some((photoId) => !isPhotoId(photoId))) {
    throw new Error("照片 ID 必须是 32 位小写十六进制内容 ID");
  }

  const catalog = await loadPhotoCatalog(options.store);
  const alreadyRetired = photoIds.filter((photoId) => catalog.isPhotoRetired(photoId));
  const activePhotoIds = photoIds.filter((photoId) => !catalog.isPhotoRetired(photoId));
  await loadPhotoCatalogMonths(
    options.store,
    catalog,
    activePhotoIds.flatMap((photoId) => catalog.photoMonth(photoId) ?? []),
  );

  if (activePhotoIds.length === 0) {
    return {
      retired: 0,
      alreadyRetired: alreadyRetired.length,
      retiredObjects: 0,
      updatedPeriods: 0,
    };
  }

  const objectKeys = catalog.retirePhotos(
    activePhotoIds,
    photoRetirementDeadline(options.now?.() ?? new Date()),
  );
  const updatedPeriods = catalog.dirtyMonths().length;
  await writePhotoCatalog(options.store, catalog, options.now?.() ?? new Date());

  return {
    retired: activePhotoIds.length,
    alreadyRetired: alreadyRetired.length,
    retiredObjects: objectKeys.size,
    updatedPeriods,
  };
}
