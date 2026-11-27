import { photoMediaObjectKey, type PhotoVariantWidth } from "../../src/lib/photo-artifact";
import {
  PHOTO_DISPLAY_WIDTH,
  PHOTO_FULL_WIDTH,
  PHOTO_THUMBNAIL_WIDTH,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import {
  editPhotoCatalog,
  PhotoCatalogEditor,
  type PhotoCatalogEditor as PhotoCatalogEditorType,
} from "./photo-catalog-store";
import { collectPhotoGarbageBestEffort } from "./photo-garbage-collector";
import { encodeAvifVariants } from "./photo-source";
import type { PhotoObjectStore } from "./photo-store";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const PROCESS_CONCURRENCY = 2;

export const PHOTO_BACKFILL_AVIF_WIDTHS: readonly PhotoVariantWidth[] = [
  PHOTO_THUMBNAIL_WIDTH,
  PHOTO_DISPLAY_WIDTH,
];

export type BackfillPhotoAvifProgress =
  | { type: "processing"; month: string; photoId: string; index: number; total: number }
  | { type: "backfilled"; month: string; photoId: string; widths: PhotoVariantWidth[] };

export type BackfillPhotoAvifOptions = {
  store: PhotoObjectStore;
  widths?: readonly PhotoVariantWidth[];
  encodeAvif?: (
    source: Uint8Array,
    widths: readonly PhotoVariantWidth[],
  ) => Promise<Map<PhotoVariantWidth, Uint8Array>>;
  now?: () => Date;
  onProgress?: (progress: BackfillPhotoAvifProgress) => void;
  onWarning?: (message: string) => void;
};

export type BackfillPhotoAvifResult = {
  scannedPhotos: number;
  backfilledPhotos: number;
  skippedPhotos: number;
  updatedPeriods: number;
};

export async function backfillPhotoAvif(
  options: BackfillPhotoAvifOptions,
): Promise<BackfillPhotoAvifResult> {
  const targetWidths = [...new Set(options.widths ?? PHOTO_BACKFILL_AVIF_WIDTHS)].toSorted(
    (left, right) => left - right,
  );
  if (targetWidths.length === 0) {
    throw new Error("至少需要指定一个 AVIF 目标宽度");
  }
  const encodeAvif = options.encodeAvif ?? encodeAvifVariants;
  const initialCatalog = await PhotoCatalogEditor.load(options.store);
  const periods = initialCatalog.periods();

  let scannedPhotos = 0;
  let backfilledPhotos = 0;
  let skippedPhotos = 0;
  let updatedPeriods = 0;

  for (const period of periods) {
    const preparedUpdates = new Map<
      string,
      { mediaRevision?: string; widths: PhotoVariantWidth[] }
    >();
    let monthScanned = 0;
    let monthSkipped = 0;

    const monthResult = await editPhotoCatalog(
      options.store,
      async (catalog) => {
        if (preparedUpdates.size === 0) {
          return { backfilled: 0, updatedPeriods: 0 };
        }
        const backfilled = await catalog.addPhotoAvifWidths(preparedUpdates);
        const committed = await catalog.commit(options.now?.() ?? new Date());
        return { backfilled, updatedPeriods: committed.updatedPeriods };
      },
      async (catalog) => {
        const shard = await catalog.readMonth(period.month);
        if (!shard) {
          return;
        }
        monthScanned = shard.photos.length;
        const pending = shard.photos
          .map((photo) => {
            const existing = new Set(photo.avifWidths ?? []);
            const missingWidths = targetWidths.filter((width) => !existing.has(width));
            return { photo, missingWidths };
          })
          .filter((item) => item.missingWidths.length > 0);
        monthSkipped = shard.photos.length - pending.length;

        if (pending.length === 0) {
          return;
        }

        await mapWithConcurrency(
          pending,
          PROCESS_CONCURRENCY,
          async ({ photo, missingWidths }, index) => {
            options.onProgress?.({
              type: "processing",
              month: period.month,
              photoId: photo.id,
              index: index + 1,
              total: pending.length,
            });
            await uploadBackfilledAvif(options.store, catalog, photo, missingWidths, encodeAvif);
            preparedUpdates.set(photo.id, {
              mediaRevision: photo.mediaRevision,
              widths: missingWidths,
            });
          },
        );
      },
    );

    scannedPhotos += monthScanned;
    skippedPhotos += monthSkipped;
    backfilledPhotos += monthResult.backfilled;
    updatedPeriods += monthResult.updatedPeriods;
    if (monthResult.backfilled > 0) {
      for (const [photoId, { widths }] of preparedUpdates) {
        options.onProgress?.({
          type: "backfilled",
          month: period.month,
          photoId,
          widths,
        });
      }
    }
  }

  await collectPhotoGarbageBestEffort(options, options.onWarning);
  return {
    scannedPhotos,
    backfilledPhotos,
    skippedPhotos,
    updatedPeriods,
  };
}

async function uploadBackfilledAvif(
  store: PhotoObjectStore,
  catalog: PhotoCatalogEditorType,
  photo: { id: string; mediaRevision?: string },
  missingWidths: PhotoVariantWidth[],
  encodeAvif: (
    source: Uint8Array,
    widths: readonly PhotoVariantWidth[],
  ) => Promise<Map<PhotoVariantWidth, Uint8Array>>,
): Promise<void> {
  const targetKeys = missingWidths.map((width) =>
    photoMediaObjectKey(photo.id, width, photo.mediaRevision, "avif"),
  );
  catalog.assertArtifactsNotRetired(targetKeys);

  const sourceKey = photoMediaObjectKey(photo.id, PHOTO_FULL_WIDTH, photo.mediaRevision, "webp");
  const source = await store.getBytes(sourceKey);
  if (!source) {
    throw new Error(`照片 ${photo.id} 缺少用于回填的源图 ${sourceKey}`);
  }
  const encoded = await encodeAvif(source.bytes, missingWidths);
  for (const width of missingWidths) {
    const body = encoded.get(width);
    if (!body) {
      throw new Error(`照片 ${photo.id} 缺少生成的 ${width}px AVIF 版本`);
    }
    await catalog.putArtifact(
      photoMediaObjectKey(photo.id, width, photo.mediaRevision, "avif"),
      body,
      {
        contentType: "image/avif",
        cacheControl: ASSET_CACHE_CONTROL,
      },
    );
  }
}
