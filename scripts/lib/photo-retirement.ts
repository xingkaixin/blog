import { isPhotoId } from "../../src/lib/photo-catalog";
import { photoRetirementDeadline } from "./photo-catalog-state";
import { editPhotoCatalog, type PhotoCatalogEditor } from "./photo-catalog-store";
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
  const result = await editPhotoCatalog(options.store, (catalog) =>
    retirePhotosOnce({ ...options, now: () => now }, catalog),
  );
  await collectPhotoGarbageBestEffort({ store: options.store, now: () => now }, options.onWarning);
  return result;
}

async function retirePhotosOnce(
  options: RetirePhotosOptions,
  catalog: PhotoCatalogEditor,
): Promise<RetirePhotosResult> {
  const photoIds = [...new Set(options.photoIds)];
  if (photoIds.length === 0) {
    throw new Error("至少需要指定一张照片");
  }
  if (photoIds.some((photoId) => !isPhotoId(photoId))) {
    throw new Error("照片 ID 必须是 32 位小写十六进制内容 ID");
  }

  const statuses = await catalog.inspectPhotos(photoIds);
  const alreadyRetired = photoIds.filter((photoId) => statuses.get(photoId) === "retired");
  const activePhotoIds = photoIds.filter((photoId) => statuses.get(photoId) === "published");
  const absentPhotoIds = photoIds.filter((photoId) => statuses.get(photoId) === "absent");
  if (absentPhotoIds.length > 0) {
    throw new Error(`Catalog 中不存在照片 ${absentPhotoIds[0]}`);
  }

  if (activePhotoIds.length === 0) {
    await catalog.commit(options.now?.() ?? new Date());
    return {
      retired: 0,
      alreadyRetired: alreadyRetired.length,
      retiredObjects: 0,
      updatedPeriods: 0,
    };
  }

  const objectKeys = await catalog.retirePhotos(
    activePhotoIds,
    photoRetirementDeadline(options.now?.() ?? new Date()),
  );
  const { updatedPeriods } = await catalog.commit(options.now?.() ?? new Date());

  return {
    retired: activePhotoIds.length,
    alreadyRetired: alreadyRetired.length,
    retiredObjects: objectKeys.size,
    updatedPeriods,
  };
}
