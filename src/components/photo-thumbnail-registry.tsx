import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

export type PhotoThumbnailRegistry = {
  register: (photoId: string, element: HTMLElement) => () => void;
  findVisible: (photoId: string) => HTMLElement | null;
  findAny: (photoId: string) => HTMLElement | null;
};

const NOOP_REGISTRY: PhotoThumbnailRegistry = {
  register: () => () => {},
  findVisible: () => null,
  findAny: () => null,
};

export const PhotoThumbnailRegistryContext = createContext<PhotoThumbnailRegistry>(NOOP_REGISTRY);

export function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replaceAll('"', '\\"');
}

function isThumbnailVisible(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest("[inert]")) {
    return false;
  }
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  return (
    rect.bottom > 8 &&
    rect.top < window.innerHeight - 8 &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

function queryFallbackThumbnails(photoId: string): HTMLElement[] {
  if (typeof document === "undefined") {
    return [];
  }
  return [...document.querySelectorAll<HTMLElement>(`[data-photo-id="${cssEscape(photoId)}"]`)];
}

export function PhotoThumbnailRegistryProvider({
  active = true,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  const tilesRef = useRef(new Map<string, Set<HTMLElement>>());
  const registry = useMemo<PhotoThumbnailRegistry>(() => {
    if (!active) {
      return NOOP_REGISTRY;
    }
    return {
      register: (photoId, element) => {
        let bucket = tilesRef.current.get(photoId);
        if (!bucket) {
          bucket = new Set();
          tilesRef.current.set(photoId, bucket);
        }
        bucket.add(element);
        return () => {
          const current = tilesRef.current.get(photoId);
          if (!current) {
            return;
          }
          current.delete(element);
          if (current.size === 0) {
            tilesRef.current.delete(photoId);
          }
        };
      },
      findVisible: (photoId) => {
        const candidates = tilesRef.current.get(photoId);
        if (candidates) {
          for (const candidate of candidates) {
            if (isThumbnailVisible(candidate)) {
              return candidate;
            }
          }
        }
        for (const candidate of queryFallbackThumbnails(photoId)) {
          if (isThumbnailVisible(candidate)) {
            return candidate;
          }
        }
        return null;
      },
      findAny: (photoId) => {
        const candidates = tilesRef.current.get(photoId);
        if (candidates) {
          for (const candidate of candidates) {
            if (candidate.isConnected && !candidate.closest("[inert]")) {
              return candidate;
            }
          }
        }
        for (const candidate of queryFallbackThumbnails(photoId)) {
          if (candidate.isConnected && !candidate.closest("[inert]")) {
            return candidate;
          }
        }
        return null;
      },
    };
  }, [active]);

  return <PhotoThumbnailRegistryContext value={registry}>{children}</PhotoThumbnailRegistryContext>;
}

export function useRegisterPhotoThumbnail(photoId: string | undefined) {
  const registry = useContext(PhotoThumbnailRegistryContext);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (node && photoId) {
        cleanupRef.current = registry.register(photoId, node);
      }
    },
    [photoId, registry],
  );

  useLayoutEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [setRef]);

  return setRef;
}
