import { PHOTO_VARIANT_WIDTHS, isPhotoId, type PhotoRecord } from "../../src/lib/photo-catalog";
import {
  loadPhotoCatalog,
  loadPhotoCatalogMonths,
  retryPhotoCatalogMutation,
  writePhotoCatalog,
  type LoadedPhotoCatalog,
} from "./photo-catalog-store";
import { collectPhotoGarbageBestEffort } from "./photo-garbage-collector";
import { photoRetirementDeadline } from "./photo-retirement";
import type { PhotoObjectStore } from "./photo-store";

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

export async function deletePhotos(options: DeletePhotosOptions): Promise<DeletePhotosResult> {
  const now = options.now?.() ?? new Date();
  const result = await retryPhotoCatalogMutation(() =>
    deletePhotosOnce({ ...options, now: () => now }),
  );
  await collectPhotoGarbageBestEffort({ store: options.store, now: () => now }, options.onWarning);
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
    retirePhoto(catalog, month, photo, deleteAfter, objectKeys);
  }
  await writePhotoCatalog(options.store, catalog, dirtyMonths, options.now?.() ?? new Date());

  return {
    deleted: activePhotoIds.length,
    alreadyRetired: alreadyRetired.length,
    retiredObjects: objectKeys.size,
    updatedPeriods: dirtyMonths.size,
  };
}

function retirePhoto(
  catalog: LoadedPhotoCatalog,
  month: string,
  photo: PhotoRecord,
  deleteAfter: string,
  objectKeys: Set<string>,
): void {
  const photoObjectKeys = new Set<string>();
  const oldPeriodPath = catalog.periods.get(month)?.path;
  if (oldPeriodPath) {
    objectKeys.add(oldPeriodPath);
  }
  for (const width of PHOTO_VARIANT_WIDTHS) {
    photoObjectKeys.add(`media/${photo.id}/${width}.webp`);
  }
  catalog.retiredObjects.set(photo.id, {
    photoId: photo.id,
    objectKeys: [...photoObjectKeys].toSorted(),
    deleteAfter,
  });
  for (const key of photoObjectKeys) {
    objectKeys.add(key);
  }
}
