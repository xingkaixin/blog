export const PHOTO_VARIANT_WIDTHS = [480, 960, 2048] as const;
export const PHOTO_MEDIA_FORMATS = ["webp", "avif"] as const;

export type PhotoVariantWidth = (typeof PHOTO_VARIANT_WIDTHS)[number];
export type PhotoMediaFormat = (typeof PHOTO_MEDIA_FORMATS)[number];

const PHOTO_ID_PATTERN = /^[a-f0-9]{32}$/;
const PHOTO_REVISION_PATTERN = /^[a-f0-9]{24}$/;
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const MONTH_CATALOG_KEY_PATTERN = new RegExp(
  `^catalog/months/(${MONTH_PATTERN.source.slice(1, -1)})\\.([a-f0-9]{24})\\.json$`,
);
const MEDIA_OBJECT_KEY_PATTERN = new RegExp(
  `^media/([a-f0-9]{32})/(?:[a-f0-9]{24}/)?(?:${PHOTO_VARIANT_WIDTHS.join("|")})\\.(?:${PHOTO_MEDIA_FORMATS.join("|")})$`,
);

export function isPhotoVariantWidth(value: unknown): value is PhotoVariantWidth {
  return typeof value === "number" && PHOTO_VARIANT_WIDTHS.includes(value as PhotoVariantWidth);
}

export function isPhotoId(value: string): boolean {
  return PHOTO_ID_PATTERN.test(value);
}

export function isPhotoMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function isPhotoRevision(value: string): boolean {
  return PHOTO_REVISION_PATTERN.test(value);
}

export function photoMediaObjectKey(
  photoId: string,
  width: PhotoVariantWidth,
  revision?: string,
  format: PhotoMediaFormat = "webp",
): string {
  return `media/${photoId}/${revision ? `${revision}/` : ""}${width}.${format}`;
}

export function photoMonthCatalogObjectKey(month: string, revision: string): string {
  return `catalog/months/${month}.${revision}.json`;
}

export function photoIdFromMediaObjectKey(key: string): string | null {
  return MEDIA_OBJECT_KEY_PATTERN.exec(key)?.[1] ?? null;
}

export function monthFromPhotoMonthCatalogObjectKey(key: string): string | null {
  return MONTH_CATALOG_KEY_PATTERN.exec(key)?.[1] ?? null;
}

export function isPhotoArtifactKey(key: string): boolean {
  return (
    photoIdFromMediaObjectKey(key) !== null || monthFromPhotoMonthCatalogObjectKey(key) !== null
  );
}
