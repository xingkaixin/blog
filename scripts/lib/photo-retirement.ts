import { isPhotoId } from "../../src/lib/photo-catalog";
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
  updatedPeriods: number;
};

export async function retirePhotos(options: RetirePhotosOptions): Promise<RetirePhotosResult> {
  const result = await editPhotoCatalog(options.store, (catalog) =>
    retirePhotosOnce(options, catalog),
  );
  await collectPhotoGarbageBestEffort(options, options.onWarning);
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
  const absentPhotoId = photoIds.find((photoId) => !statuses.get(photoId));
  if (absentPhotoId) {
    throw new Error(`Catalog 中不存在照片 ${absentPhotoId}`);
  }
  await catalog.retirePhotos(photoIds);
  const { updatedPeriods } = await catalog.commit(options.now?.() ?? new Date());

  return {
    retired: photoIds.length,
    updatedPeriods,
  };
}
