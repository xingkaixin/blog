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

export class PhotoCatalogBrowser {
  readonly baseUrl: string;
  readonly request: PhotoCatalogRequest;
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
    const value = await this.request(catalogIndexUrl(this.baseUrl), {
      cache: "no-cache",
      signal,
    });
    return parsePhotoCatalogIndex(value);
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

export function photoLookupPeriods(index: PhotoCatalogIndex, photoId: string): PhotoPeriod[] {
  const located = locatePhotoPeriod(index, photoId);
  return located ? [located] : [];
}

export async function resolveCatalogPhoto(
  index: PhotoCatalogIndex,
  photoId: string,
  loadedMonths: Iterable<PhotoMonthCatalog>,
  loadMonth: (period: PhotoPeriod) => Promise<PhotoMonthCatalog>,
): Promise<PhotoRecord | null> {
  for (const month of loadedMonths) {
    const loaded = month.photos.find((photo) => photo.id === photoId);
    if (loaded) {
      return loaded;
    }
  }

  const failures: unknown[] = [];
  for (const period of photoLookupPeriods(index, photoId)) {
    try {
      const photo = (await loadMonth(period)).photos.find((candidate) => candidate.id === photoId);
      if (photo) {
        return photo;
      }
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, `无法定位照片 ${photoId}`);
  }
  return null;
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
    throw new Error(`照片 Catalog 请求失败 (${response.status})`);
  }
  return response.json();
}
