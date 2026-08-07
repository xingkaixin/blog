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
} from "./photo-catalog";

export type PhotoView = { mode: "overview" } | { mode: "timeline"; albumId: string | null };

export type PhotoLocation = {
  href: string;
  photoId: string | null;
  view: PhotoView;
};

export type PhotoCloseNavigation = { history: "back" } | { history: "replace"; href: string };

export type PhotoCatalogRequest = (
  url: string,
  options: { cache: RequestCache; signal?: AbortSignal },
) => Promise<unknown>;

const PHOTO_ID_PATTERN = /^[a-f0-9]{32}$/;

export class PhotoCatalogBrowser {
  readonly baseUrl: string;
  readonly request: PhotoCatalogRequest;
  private generation = 0;
  private readonly months = new Map<string, PhotoMonthCatalog>();
  private readonly pendingMonths = new Map<string, Promise<PhotoMonthCatalog>>();

  constructor(baseUrl: string, request: PhotoCatalogRequest = requestJson) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.request = request;
  }

  reset(): void {
    this.generation += 1;
    this.months.clear();
    this.pendingMonths.clear();
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
    const loaded = this.months.get(period.month);
    if (loaded) {
      return Promise.resolve(loaded);
    }
    const pending = this.pendingMonths.get(period.month);
    if (pending) {
      return pending;
    }

    const generation = this.generation;
    const request = this.request(photoObjectUrl(this.baseUrl, period.path), {
      cache: "force-cache",
      signal,
    })
      .then((value) => validatePhotoMonth(index, period, parsePhotoMonthCatalog(value)))
      .then((month) => {
        if (this.generation === generation) {
          this.months.set(period.month, month);
        }
        return month;
      })
      .finally(() => {
        if (this.pendingMonths.get(period.month) === request) {
          this.pendingMonths.delete(period.month);
        }
      });
    this.pendingMonths.set(period.month, request);
    return request;
  }
}

export function readPhotoLocation(href: string, index: PhotoCatalogIndex): PhotoLocation {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const legacyAlbumId = url.searchParams.get("album");
  if (legacyAlbumId !== null) {
    if (!hash.has("album")) {
      hash.set("album", legacyAlbumId);
    }
    url.searchParams.delete("album");
    writeHash(url, hash);
  }

  const requestedAlbumId = hash.get("album");
  const view: PhotoView = hash.has("album")
    ? {
        mode: "timeline",
        albumId: index.albums.some((album) => album.id === requestedAlbumId)
          ? requestedAlbumId
          : null,
      }
    : { mode: "overview" };
  const requestedPhotoId = hash.get("photo");
  return {
    href: url.href,
    photoId: requestedPhotoId && PHOTO_ID_PATTERN.test(requestedPhotoId) ? requestedPhotoId : null,
    view,
  };
}

export function photoLocationHref(href: string, photoId: string | null): string {
  const url = new URL(href);
  setHashParam(url, "photo", photoId);
  return url.href;
}

export function timelineLocationHref(href: string, albumId: string | null): string {
  const url = new URL(href);
  url.searchParams.delete("album");
  setHashParam(url, "album", albumId ?? "");
  setHashParam(url, "photo", null);
  return url.href;
}

export function overviewLocationHref(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("album");
  setHashParam(url, "album", null);
  setHashParam(url, "photo", null);
  return url.href;
}

export function photoLookupPeriods(index: PhotoCatalogIndex, photoId: string): PhotoPeriod[] {
  const located = locatePhotoPeriod(index, photoId);
  return located ? [located] : index.periods;
}

export function photoHistoryState(current: unknown, photoId: string): Record<string, unknown> {
  const state = typeof current === "object" && current !== null ? current : {};
  return { ...state, photoWall: true, photoId };
}

export function isPhotoHistoryState(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "photoWall" in value &&
    value.photoWall === true &&
    "photoId" in value &&
    typeof value.photoId === "string" &&
    PHOTO_ID_PATTERN.test(value.photoId)
  );
}

export function planPhotoClose(href: string, state: unknown): PhotoCloseNavigation {
  return isPhotoHistoryState(state)
    ? { history: "back" }
    : { history: "replace", href: photoLocationHref(href, null) };
}

function setHashParam(url: URL, key: "album" | "photo", value: string | null): void {
  const hash = new URLSearchParams(url.hash.slice(1));
  if (value === null) {
    hash.delete(key);
  } else {
    hash.set(key, value);
  }
  writeHash(url, hash);
}

function writeHash(url: URL, hash: URLSearchParams): void {
  url.hash = hash.toString();
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
