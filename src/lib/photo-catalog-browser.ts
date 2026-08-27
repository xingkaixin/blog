import {
  catalogIndexUrl,
  locatePhotoPeriod,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  photoObjectUrl,
  validatePhotoMonth,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
} from "./photo-catalog";

export type PhotoCatalogRequest = (
  url: string,
  options: { cache: RequestCache; signal?: AbortSignal },
) => Promise<unknown>;

export type PhotoResolution =
  | { status: "ready"; photo: PhotoRecord }
  | { status: "missing" }
  | { status: "error"; message: string; cause: unknown };

export type PhotoNavigation = {
  previous: PhotoRecord | undefined;
  next: PhotoRecord | undefined;
  position: number;
  total: number;
};

export class PhotoCatalogNotFoundError extends Error {}

export class PhotoCatalogBrowser {
  readonly baseUrl: string;
  readonly request: PhotoCatalogRequest;
  private pendingIndex:
    | { signal: AbortSignal | undefined; request: Promise<PhotoCatalogIndex> }
    | undefined;
  private readonly pendingMonths = new Map<
    string,
    { signal: AbortSignal | undefined; request: Promise<PhotoMonthCatalog> }
  >();

  constructor(baseUrl: string, request: PhotoCatalogRequest = requestJson) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.request = request;
  }

  async loadIndex(signal?: AbortSignal): Promise<PhotoCatalogIndex> {
    if (!this.baseUrl) {
      throw new Error("照片存储地址尚未配置");
    }
    if (this.pendingIndex && this.pendingIndex.signal === signal) {
      return this.pendingIndex.request;
    }
    const request = this.request(catalogIndexUrl(this.baseUrl), {
      cache: "no-cache",
      signal,
    })
      .then(parsePhotoCatalogIndex)
      .finally(() => {
        if (this.pendingIndex?.request === request) {
          this.pendingIndex = undefined;
        }
      });
    this.pendingIndex = { signal, request };
    return request;
  }

  loadMonth(
    index: PhotoCatalogIndex,
    period: PhotoPeriod,
    signal?: AbortSignal,
  ): Promise<PhotoMonthCatalog> {
    const pending = this.pendingMonths.get(period.path);
    if (pending && pending.signal === signal) {
      return pending.request;
    }

    const request = this.request(photoObjectUrl(this.baseUrl, period.path), {
      cache: "force-cache",
      signal,
    })
      .then((value) => validatePhotoMonth(index, period, parsePhotoMonthCatalog(value)))
      .finally(() => {
        if (this.pendingMonths.get(period.path)?.request === request) {
          this.pendingMonths.delete(period.path);
        }
      });
    this.pendingMonths.set(period.path, { signal, request });
    return request;
  }
}

export async function resolveCatalogPhoto(
  index: PhotoCatalogIndex,
  photoId: string,
  loadedMonths: Readonly<Record<string, PhotoMonthCatalog>>,
  loadMonth: (period: PhotoPeriod) => Promise<PhotoMonthCatalog>,
): Promise<PhotoRecord | null> {
  const period = locatePhotoPeriod(index, photoId);
  if (!period) {
    return null;
  }
  const month = loadedMonths[period.month] ?? (await loadMonth(period));
  return month.photos.find((photo) => photo.id === photoId) ?? null;
}

export function planPhotoNavigation(
  index: PhotoCatalogIndex,
  photo: PhotoRecord,
  albumId: string | null,
  loadedMonths: Readonly<Record<string, PhotoMonthCatalog>>,
): { navigation: PhotoNavigation; pendingPeriods: PhotoPeriod[] } | null {
  const selectedAlbumId = albumId && photo.albumIds.includes(albumId) ? albumId : null;
  const photoCount = (period: PhotoPeriod) =>
    selectedAlbumId ? (period.albumCounts[selectedAlbumId] ?? 0) : period.count;
  const periods = index.periods.filter((period) => photoCount(period) > 0);
  const periodIndex = periods.findIndex((period) => period.month === index.photoMonths[photo.id]);
  if (periodIndex < 0) {
    return null;
  }

  const monthPhotos = (period: PhotoPeriod) =>
    loadedMonths[period.month]?.photos.filter(
      (candidate) => !selectedAlbumId || candidate.albumIds.includes(selectedAlbumId),
    ) ?? [];
  const photos = monthPhotos(periods[periodIndex]);
  const photoIndex = photos.findIndex((candidate) => candidate.id === photo.id);
  if (photoIndex < 0) {
    return null;
  }

  const pendingPeriods: PhotoPeriod[] = [];
  const adjacentPhoto = (direction: -1 | 1): PhotoRecord | undefined => {
    const adjacent = photos[photoIndex + direction];
    if (adjacent) {
      return adjacent;
    }
    const period = periods[periodIndex + direction];
    if (!period) {
      return undefined;
    }
    if (!loadedMonths[period.month]) {
      pendingPeriods.push(period);
      return undefined;
    }
    const candidates = monthPhotos(period);
    return direction === -1 ? candidates.at(-1) : candidates[0];
  };

  return {
    navigation: {
      previous: adjacentPhoto(-1),
      next: adjacentPhoto(1),
      position:
        periods.slice(0, periodIndex).reduce((sum, period) => sum + photoCount(period), 0) +
        photoIndex +
        1,
      total: periods.reduce((sum, period) => sum + photoCount(period), 0),
    },
    pendingPeriods,
  };
}

export async function resolvePhotoSelection(
  photoId: string,
  resolvePhoto: (photoId: string) => Promise<PhotoRecord | null>,
): Promise<PhotoResolution> {
  try {
    const photo = await resolvePhoto(photoId);
    return photo ? { status: "ready", photo } : { status: "missing" };
  } catch (cause) {
    return {
      status: "error",
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    };
  }
}

async function requestJson(
  url: string,
  options: { cache: RequestCache; signal?: AbortSignal },
): Promise<unknown> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = `照片 Catalog 请求失败 (${response.status})`;
    throw response.status === 404 || response.status === 410
      ? new PhotoCatalogNotFoundError(message)
      : new Error(message);
  }
  return response.json();
}
