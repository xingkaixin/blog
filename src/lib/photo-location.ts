import { isPhotoId, type PhotoCatalogIndex } from "./photo-catalog";

export type PhotoView = { mode: "overview" } | { mode: "timeline"; albumId: string | null };

export type PhotoLocation = {
  href: string;
  photoId: string | null;
  view: PhotoView;
};

export type PhotoLocationNavigationPlan = {
  history: "push" | "replace";
  href: string;
  state: Record<string, unknown>;
};

export type PhotoNavigationPlan = { history: "back" } | PhotoLocationNavigationPlan;

type PhotoHistoryEntry = {
  kind: "lightbox";
  photoId: string;
};

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
  const albumId = index.albums.some((album) => album.id === requestedAlbumId)
    ? requestedAlbumId
    : null;
  if (requestedAlbumId !== null && albumId === null && requestedAlbumId !== "") {
    hash.set("album", "");
    writeHash(url, hash);
  }
  const view: PhotoView = hash.has("album")
    ? {
        mode: "timeline",
        albumId,
      }
    : { mode: "overview" };
  const requestedPhotoId = hash.get("photo");
  const photoId = requestedPhotoId && isPhotoId(requestedPhotoId) ? requestedPhotoId : null;
  if (requestedPhotoId !== null && photoId === null) {
    hash.delete("photo");
    writeHash(url, hash);
  }
  return {
    href: url.href,
    photoId,
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

export function planPhotoOpen(
  href: string,
  state: unknown,
  photoId: string,
): PhotoLocationNavigationPlan {
  return {
    history: "push",
    href: photoLocationHref(href, photoId),
    state: {
      ...withoutPhotoHistoryEntry(state),
      photoWall: { kind: "lightbox", photoId } satisfies PhotoHistoryEntry,
    },
  };
}

export function planPhotoSelection(
  href: string,
  state: unknown,
  photoId: string,
): PhotoLocationNavigationPlan {
  const entry = readPhotoHistoryEntry(state);
  return {
    history: "replace",
    href: photoLocationHref(href, photoId),
    state: entry
      ? {
          ...withoutPhotoHistoryEntry(state),
          photoWall: { ...entry, photoId } satisfies PhotoHistoryEntry,
        }
      : withoutPhotoHistoryEntry(state),
  };
}

export function planPhotoClose(href: string, state: unknown): PhotoNavigationPlan {
  const entry = readPhotoHistoryEntry(state);
  return entry
    ? { history: "back" }
    : {
        history: "replace",
        href: photoLocationHref(href, null),
        state: withoutPhotoHistoryEntry(state),
      };
}

export function planTimelineOpen(
  href: string,
  state: unknown,
  albumId: string | null,
): PhotoLocationNavigationPlan {
  return {
    history: "push",
    href: timelineLocationHref(href, albumId),
    state: withoutPhotoHistoryEntry(state),
  };
}

export function planTimelineSelection(
  href: string,
  state: unknown,
  albumId: string | null,
): PhotoLocationNavigationPlan {
  return {
    history: "replace",
    href: timelineLocationHref(href, albumId),
    state: withoutPhotoHistoryEntry(state),
  };
}

export function planOverviewOpen(href: string, state: unknown): PhotoLocationNavigationPlan {
  return {
    history: "replace",
    href: overviewLocationHref(href),
    state: withoutPhotoHistoryEntry(state),
  };
}

export function applyPhotoNavigation(plan: PhotoNavigationPlan, target: History): void {
  if (plan.history === "back") {
    target.back();
  } else if (plan.history === "push") {
    target.pushState(plan.state, "", plan.href);
  } else {
    target.replaceState(plan.state, "", plan.href);
  }
}

function readPhotoHistoryEntry(value: unknown): PhotoHistoryEntry | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const entry = Reflect.get(value, "photoWall");
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }
  const kind = Reflect.get(entry, "kind");
  const photoId = Reflect.get(entry, "photoId");
  return kind === "lightbox" && typeof photoId === "string" && isPhotoId(photoId)
    ? { kind, photoId }
    : null;
}

function withoutPhotoHistoryEntry(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const state = { ...(value as Record<string, unknown>) };
  delete state.photoWall;
  return state;
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
