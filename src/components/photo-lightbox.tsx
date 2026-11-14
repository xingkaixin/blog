import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { PhotoBrowsingNavigation } from "@/hooks/use-photo-browsing-session";
import { usePhotoLocale, usePhotoMessages } from "@/hooks/use-photo-messages";
import { formatPhotoCapturedAt } from "@/lib/photo-captured-at";
import {
  PHOTO_DISPLAY_WIDTH,
  PHOTO_FULL_WIDTH,
  PHOTO_THUMBNAIL_WIDTH,
  photoVariantSrcSet,
  photoVariantUrl,
  type PhotoAlbum,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import { photoFromArrow, photoFromSwipe, planPhotoPreload } from "@/lib/photo-preload";
import { getCssEasing, isDesktopViewport, prefersReducedMotion } from "@/lib/sliding-pill";
import { cn } from "@/lib/utils";

const LIGHTBOX_VARIANT_WIDTHS = [PHOTO_DISPLAY_WIDTH, PHOTO_FULL_WIDTH] as const;
const LIGHTBOX_IMAGE_SIZES = "100vw";
const LIGHTBOX_BUTTON_CLASS_NAME =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface/85 text-ink-800 transition-[transform,border-color] hover:border-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.96]";

const DRAG_DISMISS_DISTANCE = 110;
const DRAG_DISMISS_VELOCITY = 0.45;
const DRAG_MIN_SCALE = 0.82;
const DRAG_MAX_RADIUS = 14;
const DRAG_PROGRESS_SPAN = 280;
const CHROME_FADE_DELAY_MS = 60;

type PhotoThumbnailRegistry = {
  register: (photoId: string, element: HTMLElement) => () => void;
  findVisible: (photoId: string) => HTMLElement | null;
  findAny: (photoId: string) => HTMLElement | null;
};

const NOOP_REGISTRY: PhotoThumbnailRegistry = {
  register: () => () => {},
  findVisible: () => null,
  findAny: () => null,
};

const PhotoThumbnailRegistryContext = createContext<PhotoThumbnailRegistry>(NOOP_REGISTRY);

function cssEscape(value: string): string {
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

type PhotoLightboxProps = {
  baseUrl: string;
  open: boolean;
  photo: PhotoRecord;
  navigation: PhotoBrowsingNavigation;
  albums: PhotoAlbum[];
  triggerElement?: HTMLElement | null;
  onClose: () => void;
  onCloseComplete?: () => void;
  onSelect: (photo: PhotoRecord) => void;
  onRetryNavigation: () => void;
};

type FlipGeometry = {
  transform: string;
  borderRadius: string;
  clipPath: string;
};

type DragSnapshot = {
  x: number;
  y: number;
  scale: number;
  radius: number;
  transform: string;
  backdropOpacity: number;
  chromeOpacity: number;
};

type GestureState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  vy: number;
  dx: number;
  dy: number;
  axis: "pending" | "horizontal" | "vertical";
  snapshot: DragSnapshot;
};

function revealIfOutsideViewport(element: HTMLElement | null): void {
  if (!element) {
    return;
  }
  const bounds = element.getBoundingClientRect();
  if (bounds.bottom > 0 && bounds.top < window.innerHeight) {
    return;
  }
  element.scrollIntoView({ block: "center", inline: "nearest" });
}

function loadedTileSource(photoId: string, registry: PhotoThumbnailRegistry): string | undefined {
  const registered = registry.findAny(photoId);
  const tile =
    registered instanceof HTMLImageElement
      ? registered
      : (registered?.querySelector("img") ??
        document.querySelector<HTMLImageElement>(`[data-photo-id="${cssEscape(photoId)}"] img`));
  return tile?.complete && tile.naturalWidth > 0 ? tile.currentSrc : undefined;
}

function computeFlipFromThumbnail(srcElement: HTMLElement, dstRect: DOMRect): FlipGeometry {
  const srcRect = srcElement.getBoundingClientRect();
  const srcCenterX = srcRect.left + srcRect.width / 2;
  const srcCenterY = srcRect.top + srcRect.height / 2;
  const dstCenterX = dstRect.left + dstRect.width / 2;
  const dstCenterY = dstRect.top + dstRect.height / 2;
  const tx = srcCenterX - dstCenterX;
  const ty = srcCenterY - dstCenterY;

  const scale = Math.max(srcRect.width / dstRect.width, srcRect.height / dstRect.height);
  const visibleWidth = Math.min(dstRect.width, srcRect.width / scale);
  const visibleHeight = Math.min(dstRect.height, srcRect.height / scale);
  const clipX = Math.max(0, (dstRect.width - visibleWidth) / 2);
  const clipY = Math.max(0, (dstRect.height - visibleHeight) / 2);

  const rawRadius = Number.parseFloat(getComputedStyle(srcElement).borderTopLeftRadius) || 0;
  const scaledRadius = scale > 0 ? rawRadius / scale : 0;

  return {
    transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
    borderRadius: `${scaledRadius.toFixed(2)}px`,
    clipPath: `inset(${clipY.toFixed(2)}px ${clipX.toFixed(2)}px ${clipY.toFixed(2)}px ${clipX.toFixed(2)}px round ${scaledRadius.toFixed(2)}px)`,
  };
}

function computeDragSnapshot(dx: number, dy: number): DragSnapshot {
  if (dy <= 0) {
    const dampedY = dy * 0.25;
    return {
      x: 0,
      y: dampedY,
      scale: 1,
      radius: 0,
      transform: `translate3d(0, ${dampedY.toFixed(2)}px, 0) scale(1)`,
      backdropOpacity: 1,
      chromeOpacity: 1,
    };
  }
  const progress = Math.min(1, dy / DRAG_PROGRESS_SPAN);
  const x = dx * 0.2;
  const scale = Math.max(DRAG_MIN_SCALE, 1 - progress * (1 - DRAG_MIN_SCALE));
  const radius = Math.min(DRAG_MAX_RADIUS, progress * DRAG_MAX_RADIUS);
  const backdropOpacity = Math.max(0.15, 1 - progress * 0.85);
  const chromeOpacity = Math.max(0, 1 - Math.min(1, dy / 90));
  return {
    x,
    y: dy,
    scale,
    radius,
    transform: `translate3d(${x.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
    backdropOpacity,
    chromeOpacity,
  };
}

function releasePointerCaptureSafely(element: HTMLElement, pointerId: number): void {
  if (
    typeof element.hasPointerCapture === "function" &&
    typeof element.releasePointerCapture === "function" &&
    element.hasPointerCapture(pointerId)
  ) {
    try {
      element.releasePointerCapture(pointerId);
    } catch {
      // Ignore synthetic pointer events whose capture already ended.
    }
  }
}

function LightboxImage({
  baseUrl,
  photo,
  frameRef,
}: {
  baseUrl: string;
  photo: PhotoRecord;
  frameRef: Ref<HTMLDivElement>;
}) {
  const registry = useContext(PhotoThumbnailRegistryContext);
  const [previewSrc] = useState(
    () =>
      loadedTileSource(photo.id, registry) ??
      photoVariantUrl(baseUrl, photo, PHOTO_THUMBNAIL_WIDTH),
  );
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      ref={frameRef}
      className="relative overflow-hidden will-change-transform"
      style={{
        backgroundColor: photo.placeholderColor,
        aspectRatio: `${photo.width} / ${photo.height}`,
        width: `min(100cqw, 100cqh * ${photo.width / photo.height})`,
      }}
    >
      <img
        src={previewSrc}
        alt=""
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover blur-sm"
      />
      <img
        src={photoVariantUrl(baseUrl, photo, PHOTO_FULL_WIDTH)}
        srcSet={photoVariantSrcSet(baseUrl, photo, LIGHTBOX_VARIANT_WIDTHS)}
        sizes={LIGHTBOX_IMAGE_SIZES}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-(--duration-fast) ease-(--ease-smooth-out)",
          !loaded && "opacity-0",
        )}
      />
    </div>
  );
}

const POPUP_STATIC_STYLE: CSSProperties = {
  backgroundColor: "transparent",
  opacity: 1,
  scale: "1",
  transition: "none",
};

export function PhotoLightbox({
  baseUrl,
  open,
  photo,
  navigation,
  albums,
  triggerElement = null,
  onClose,
  onCloseComplete,
  onSelect,
  onRetryNavigation,
}: PhotoLightboxProps) {
  const t = usePhotoMessages();
  const locale = usePhotoLocale();
  const registry = useContext(PhotoThumbnailRegistryContext);
  const [popupMounted, setPopupMounted] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const prevRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);

  const activeAnimationsRef = useRef<Animation[]>([]);
  const wasOpenRef = useRef(false);
  const currentPhotoIdRef = useRef(photo.id);
  const gestureRef = useRef<GestureState | null>(null);
  const pendingDragCloseRef = useRef<DragSnapshot | null>(null);
  const revealOnCloseRef = useRef(false);

  currentPhotoIdRef.current = photo.id;

  const handlePopupRef = useCallback((node: HTMLDivElement | null) => {
    popupRef.current = node;
    setPopupMounted(node !== null);
  }, []);

  const getBackdrop = useCallback((): HTMLElement | null => {
    const sibling = popupRef.current?.previousElementSibling;
    if (sibling instanceof HTMLElement && sibling.classList.contains("dialog-backdrop")) {
      return sibling;
    }
    return null;
  }, []);

  const getChromeElements = useCallback((): HTMLElement[] => {
    return [headerRef.current, prevRef.current, nextRef.current, footerRef.current].filter(
      (element): element is HTMLElement => element !== null,
    );
  }, []);

  const cancelAnimations = useCallback(() => {
    for (const anim of activeAnimationsRef.current) {
      anim.cancel();
    }
    activeAnimationsRef.current = [];
  }, []);

  const trackAnimation = useCallback((anim: Animation) => {
    activeAnimationsRef.current.push(anim);
    void anim.finished
      .catch(() => {})
      .finally(() => {
        activeAnimationsRef.current = activeAnimationsRef.current.filter((item) => item !== anim);
      });
  }, []);

  const clearInlineMotionStyles = useCallback(() => {
    const frame = imageFrameRef.current;
    if (frame) {
      frame.style.removeProperty("transform");
      frame.style.removeProperty("border-radius");
      frame.style.removeProperty("clip-path");
      frame.style.removeProperty("opacity");
    }
    const backdrop = getBackdrop();
    if (backdrop) {
      backdrop.style.removeProperty("opacity");
      backdrop.style.removeProperty("transition");
    }
    for (const element of getChromeElements()) {
      element.style.removeProperty("opacity");
      element.style.removeProperty("pointer-events");
    }
  }, [getBackdrop, getChromeElements]);

  const applyDragSnapshot = useCallback(
    (snapshot: DragSnapshot) => {
      const frame = imageFrameRef.current;
      if (frame) {
        frame.style.transform = snapshot.transform;
        frame.style.borderRadius = `${snapshot.radius.toFixed(2)}px`;
      }
      const backdrop = getBackdrop();
      if (backdrop) {
        backdrop.style.transition = "none";
        backdrop.style.opacity = String(snapshot.backdropOpacity);
      }
      for (const element of getChromeElements()) {
        element.style.opacity = String(snapshot.chromeOpacity);
        element.style.pointerEvents = "none";
      }
    },
    [getBackdrop, getChromeElements],
  );

  const snapBackFromDrag = useCallback(
    (snapshot: DragSnapshot) => {
      cancelAnimations();
      clearInlineMotionStyles();
      const frame = imageFrameRef.current;
      if (!frame || prefersReducedMotion() || typeof frame.animate !== "function") {
        return;
      }
      const duration = 250;
      const easing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");
      trackAnimation(
        frame.animate(
          [
            {
              transform: snapshot.transform,
              borderRadius: `${snapshot.radius.toFixed(2)}px`,
            },
            {
              transform: "translate3d(0, 0, 0) scale(1)",
              borderRadius: "0px",
            },
          ],
          { duration, easing },
        ),
      );
      const backdrop = getBackdrop();
      if (backdrop && typeof backdrop.animate === "function") {
        backdrop.style.transition = "none";
        trackAnimation(
          backdrop.animate([{ opacity: snapshot.backdropOpacity }, { opacity: 1 }], {
            duration,
            easing,
          }),
        );
      }
      for (const element of getChromeElements()) {
        if (typeof element.animate === "function") {
          trackAnimation(
            element.animate([{ opacity: snapshot.chromeOpacity }, { opacity: 1 }], {
              duration,
              easing,
            }),
          );
        }
      }
    },
    [cancelAnimations, clearInlineMotionStyles, getBackdrop, getChromeElements, trackAnimation],
  );

  const close = () => {
    revealOnCloseRef.current = true;
    onClose();
  };

  const { previous, next } = navigation;
  const albumTitleById = useMemo(
    () => new Map(albums.map((album) => [album.id, album.title])),
    [albums],
  );
  const albumTitles = photo.albumIds
    .map((albumId) => albumTitleById.get(albumId))
    .filter((title): title is string => Boolean(title));

  const getFocusableTile = useCallback((photoId: string): HTMLElement | null => {
    const candidate = document.querySelector<HTMLElement>(
      `button[data-photo-id="${cssEscape(photoId)}"]`,
    );
    return candidate && !candidate.closest("[inert]") ? candidate : null;
  }, []);

  useLayoutEffect(() => {
    const popup = popupRef.current;
    const frame = imageFrameRef.current;
    if (!popupMounted || !popup || !frame) {
      wasOpenRef.current = false;
      return undefined;
    }

    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      gestureRef.current = null;
      pendingDragCloseRef.current = null;
      cancelAnimations();
      clearInlineMotionStyles();

      if (typeof popup.animate !== "function") {
        return undefined;
      }

      const backdrop = getBackdrop();
      const chromeElements = getChromeElements();
      const reduced = prefersReducedMotion();
      const duration = isDesktopViewport() ? 220 : 320;
      const drawerEasing = getCssEasing("--ease-drawer", "cubic-bezier(0.32, 0.72, 0, 1)");
      const smoothEasing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");

      if (backdrop) {
        backdrop.style.transition = "none";
      }

      if (reduced) {
        if (typeof frame.animate === "function") {
          trackAnimation(
            frame.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 150,
              easing: smoothEasing,
            }),
          );
        }
        if (backdrop && typeof backdrop.animate === "function") {
          trackAnimation(
            backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 150,
              easing: smoothEasing,
            }),
          );
        }
        for (const element of chromeElements) {
          if (typeof element.animate === "function") {
            trackAnimation(
              element.animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: 150,
                easing: smoothEasing,
              }),
            );
          }
        }
        return () => {
          cancelAnimations();
        };
      }

      const dstRect = frame.getBoundingClientRect();
      const srcTile = registry.findVisible(currentPhotoIdRef.current);
      if (
        srcTile &&
        dstRect.width > 0 &&
        dstRect.height > 0 &&
        typeof frame.animate === "function"
      ) {
        const flip = computeFlipFromThumbnail(srcTile, dstRect);
        trackAnimation(
          frame.animate(
            [
              {
                transform: flip.transform,
                borderRadius: flip.borderRadius,
                clipPath: flip.clipPath,
              },
              {
                transform: "translate3d(0, 0, 0) scale(1)",
                borderRadius: "0px",
                clipPath: "inset(0px 0px 0px 0px round 0px)",
              },
            ],
            { duration, easing: drawerEasing },
          ),
        );
      } else if (typeof frame.animate === "function") {
        trackAnimation(
          frame.animate(
            [
              { opacity: 0, transform: "translate3d(0, 12px, 0) scale(0.94)" },
              { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
            ],
            { duration, easing: drawerEasing },
          ),
        );
      }

      if (backdrop && typeof backdrop.animate === "function") {
        trackAnimation(
          backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration,
            easing: drawerEasing,
          }),
        );
      }

      const delayFraction = Math.min(0.45, CHROME_FADE_DELAY_MS / duration);
      for (const element of chromeElements) {
        if (typeof element.animate === "function") {
          trackAnimation(
            element.animate(
              [{ opacity: 0 }, { opacity: 0, offset: delayFraction }, { opacity: 1 }],
              { duration, easing: smoothEasing },
            ),
          );
        }
      }

      return () => {
        cancelAnimations();
      };
    }

    if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
      gestureRef.current = null;
      const dragRelease = pendingDragCloseRef.current;
      pendingDragCloseRef.current = null;
      cancelAnimations();

      if (typeof popup.animate !== "function") {
        clearInlineMotionStyles();
        return undefined;
      }

      // 测量无拖拽变换时的静止矩形，再衔接当前瞬态矩阵。
      frame.style.removeProperty("transform");
      frame.style.removeProperty("border-radius");
      frame.style.removeProperty("clip-path");
      const dstRect = frame.getBoundingClientRect();

      const backdrop = getBackdrop();
      const chromeElements = getChromeElements();
      const reduced = prefersReducedMotion();
      const duration = reduced ? 150 : dragRelease ? 240 : isDesktopViewport() ? 220 : 320;
      const drawerEasing = getCssEasing("--ease-drawer", "cubic-bezier(0.32, 0.72, 0, 1)");
      const smoothEasing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");

      const fromTransform = dragRelease ? dragRelease.transform : "translate3d(0, 0, 0) scale(1)";
      const fromRadius = dragRelease ? `${dragRelease.radius.toFixed(2)}px` : "0px";
      const fromClip = dragRelease
        ? `inset(0px 0px 0px 0px round ${dragRelease.radius.toFixed(2)}px)`
        : "inset(0px 0px 0px 0px round 0px)";
      const fromBackdropOpacity = dragRelease ? dragRelease.backdropOpacity : 1;
      const fromChromeOpacity = dragRelease ? dragRelease.chromeOpacity : 1;

      frame.style.opacity = "0";
      if (backdrop) {
        backdrop.style.transition = "none";
        backdrop.style.opacity = "0";
      }
      for (const element of chromeElements) {
        element.style.opacity = "0";
        element.style.pointerEvents = "none";
      }

      const canAnimateFrame = typeof frame.animate === "function";
      const srcTile = !reduced ? registry.findVisible(currentPhotoIdRef.current) : null;
      if (reduced) {
        if (canAnimateFrame) {
          trackAnimation(
            frame.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration,
              easing: smoothEasing,
            }),
          );
        }
      } else if (srcTile && dstRect.width > 0 && dstRect.height > 0) {
        if (canAnimateFrame) {
          const flip = computeFlipFromThumbnail(srcTile, dstRect);
          trackAnimation(
            frame.animate(
              [
                {
                  opacity: 1,
                  transform: fromTransform,
                  borderRadius: fromRadius,
                  clipPath: fromClip,
                },
                {
                  opacity: 1,
                  offset: 0.88,
                  transform: flip.transform,
                  borderRadius: flip.borderRadius,
                  clipPath: flip.clipPath,
                },
                {
                  opacity: 0,
                  transform: flip.transform,
                  borderRadius: flip.borderRadius,
                  clipPath: flip.clipPath,
                },
              ],
              { duration, easing: drawerEasing },
            ),
          );
        }
      } else if (canAnimateFrame) {
        const endTransform = dragRelease
          ? `translate3d(${dragRelease.x.toFixed(2)}px, ${(dragRelease.y + 48).toFixed(2)}px, 0) scale(${Math.max(0.72, dragRelease.scale * 0.88).toFixed(4)})`
          : "translate3d(0, 16px, 0) scale(0.9)";
        trackAnimation(
          frame.animate(
            [
              { opacity: 1, transform: fromTransform, borderRadius: fromRadius },
              { opacity: 0, transform: endTransform, borderRadius: fromRadius },
            ],
            { duration, easing: smoothEasing },
          ),
        );
      }

      if (backdrop && typeof backdrop.animate === "function") {
        trackAnimation(
          backdrop.animate([{ opacity: fromBackdropOpacity }, { opacity: 0 }], {
            duration,
            easing: reduced ? smoothEasing : drawerEasing,
          }),
        );
      }

      if (fromChromeOpacity > 0.01) {
        const chromeDuration = Math.min(130, duration);
        for (const element of chromeElements) {
          if (typeof element.animate === "function") {
            trackAnimation(
              element.animate([{ opacity: fromChromeOpacity }, { opacity: 0 }], {
                duration: chromeDuration,
                easing: smoothEasing,
              }),
            );
          }
        }
      }

      // Base UI 依据 DialogPopup 自身的在途动画决定何时卸载 Portal。
      trackAnimation(popup.animate([{ opacity: 1 }, { opacity: 1 }], { duration }));

      return () => {
        cancelAnimations();
      };
    }

    return undefined;
  }, [
    cancelAnimations,
    clearInlineMotionStyles,
    getBackdrop,
    getChromeElements,
    open,
    popupMounted,
    registry,
    trackAnimation,
  ]);

  useEffect(
    () => () => {
      wasOpenRef.current = false;
      cancelAnimations();
    },
    [cancelAnimations],
  );

  useEffect(() => {
    gestureRef.current = null;
    if (open) {
      clearInlineMotionStyles();
    }
  }, [clearInlineMotionStyles, open, photo.id]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    revealOnCloseRef.current = false;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const target = planPhotoPreload(previous, next, connection);
    if (!target || document.visibilityState !== "visible") {
      return undefined;
    }
    const preload = () => {
      const image = new Image();
      image.sizes = LIGHTBOX_IMAGE_SIZES;
      image.srcset = photoVariantSrcSet(baseUrl, target, LIGHTBOX_VARIANT_WIDTHS);
    };
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 1_500 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = globalThis.setTimeout(preload, 150);
    return () => globalThis.clearTimeout(timeoutId);
  }, [baseUrl, next, open, previous]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) {
      return undefined;
    }
    const syncZoom = () => setZoomed(viewport.scale > 1);
    viewport.addEventListener("resize", syncZoom);
    return () => viewport.removeEventListener("resize", syncZoom);
  }, [open]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!open || zoomed || !event.isPrimary) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("button, a")) {
      return;
    }
    cancelAnimations();
    if (typeof event.currentTarget.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore synthetic events without an active pointer.
      }
    }
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      vy: 0,
      dx: 0,
      dy: 0,
      axis: "pending",
      snapshot: computeDragSnapshot(0, 0),
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (!event.isPrimary || zoomed) {
      releasePointerCaptureSafely(event.currentTarget, event.pointerId);
      gestureRef.current = null;
      if (gesture.axis === "vertical") {
        snapBackFromDrag(gesture.snapshot);
      }
      return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    gesture.dx = dx;
    gesture.dy = dy;

    if (gesture.axis === "pending") {
      if (Math.hypot(dx, dy) < 6) {
        return;
      }
      if (Math.abs(dx) > Math.abs(dy) * 1.15) {
        gesture.axis = "horizontal";
        return;
      }
      gesture.axis = "vertical";
    }

    if (gesture.axis !== "vertical") {
      return;
    }

    const dt = Math.max(1, event.timeStamp - gesture.lastTime);
    const instantVy = (event.clientY - gesture.lastY) / dt;
    gesture.vy = gesture.vy * 0.4 + instantVy * 0.6;
    gesture.lastY = event.clientY;
    gesture.lastTime = event.timeStamp;

    const snapshot = computeDragSnapshot(dx, dy);
    gesture.snapshot = snapshot;
    applyDragSnapshot(snapshot);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    releasePointerCaptureSafely(event.currentTarget, event.pointerId);
    if (zoomed) {
      return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.axis === "vertical") {
      const staleVelocity = event.timeStamp - gesture.lastTime > 80;
      const finalVy = staleVelocity ? 0 : gesture.vy;
      if (dy > DRAG_DISMISS_DISTANCE || finalVy > DRAG_DISMISS_VELOCITY) {
        pendingDragCloseRef.current = gesture.snapshot;
        close();
        return;
      }
      snapBackFromDrag(gesture.snapshot);
      return;
    }

    const selected = photoFromSwipe(dx, dy, previous, next);
    if (selected) {
      onSelect(selected);
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    releasePointerCaptureSafely(event.currentTarget, event.pointerId);
    if (gesture.axis === "vertical") {
      snapBackFromDrag(gesture.snapshot);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          clearInlineMotionStyles();
          if (revealOnCloseRef.current) {
            revealOnCloseRef.current = false;
            if (!triggerElement?.isConnected) {
              revealIfOutsideViewport(getFocusableTile(currentPhotoIdRef.current));
            }
          }
          onCloseComplete?.();
        }
      }}
    >
      <DialogContent
        ref={handlePopupRef}
        title={t.lightboxTitle}
        description={formatPhotoCapturedAt(photo.capturedAt, locale)}
        finalFocus={() => {
          if (triggerElement?.isConnected) {
            return triggerElement;
          }
          return getFocusableTile(currentPhotoIdRef.current) ?? true;
        }}
        onKeyDown={(event) => {
          if (!open || event.defaultPrevented) {
            return;
          }
          const selected = photoFromArrow(event.key, previous, next);
          if (selected) {
            event.preventDefault();
            onSelect(selected);
          }
        }}
        style={POPUP_STATIC_STYLE}
        backdropClassName="bg-black/90 backdrop-blur-md"
        className="photo-lightbox fixed inset-0 left-0 top-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-transparent p-0 text-ink-800 shadow-none"
      >
        <div
          ref={headerRef}
          className="relative z-10 flex h-18 shrink-0 items-center justify-between gap-4 px-3 sm:px-6"
        >
          <div className="min-w-0">
            {albumTitles.length > 0 && (
              <p className="mb-1.5 truncate font-serif text-xl font-black leading-none text-ink-800">
                {albumTitles.join("、")}
              </p>
            )}
            <p className="truncate font-mono text-xs text-ink-500">
              {formatPhotoCapturedAt(photo.capturedAt, locale)}
            </p>
          </div>
          <button
            type="button"
            aria-label={t.closeLightbox}
            onClick={close}
            className={cn("shrink-0", LIGHTBOX_BUTTON_CLASS_NAME)}
          >
            <XIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            "relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 pb-2 [container-type:size] sm:px-16",
            zoomed ? "touch-auto" : "touch-pinch-zoom",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <LightboxImage key={photo.id} baseUrl={baseUrl} photo={photo} frameRef={imageFrameRef} />

          {previous && (
            <button
              ref={prevRef}
              type="button"
              aria-label={t.previous}
              onClick={() => onSelect(previous)}
              className={cn(
                "absolute left-3 top-1/2 z-20 -translate-y-1/2 max-sm:not-focus:sr-only sm:left-5",
                LIGHTBOX_BUTTON_CLASS_NAME,
              )}
            >
              <CaretLeftIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
          {next && (
            <button
              ref={nextRef}
              type="button"
              aria-label={t.next}
              onClick={() => onSelect(next)}
              className={cn(
                "absolute right-3 top-1/2 z-20 -translate-y-1/2 max-sm:not-focus:sr-only sm:right-5",
                LIGHTBOX_BUTTON_CLASS_NAME,
              )}
            >
              <CaretRightIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
        </div>

        <footer
          ref={footerRef}
          className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-t border-line px-3 py-2.5 font-mono text-[10px] text-ink-500 sm:px-6 sm:py-3"
        >
          <span aria-live="polite" className="min-w-16 text-ink-700">
            {navigation.position} / {navigation.total}
          </span>
          {navigation.strip.length > 1 && (
            <nav aria-label={t.sameMonth} className="hidden gap-2 sm:flex">
              {navigation.strip.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  aria-label={t.viewPhoto(formatPhotoCapturedAt(frame.capturedAt, locale))}
                  aria-current={frame.id === photo.id ? "true" : undefined}
                  onClick={() => {
                    if (frame.id !== photo.id) {
                      onSelect(frame);
                    }
                  }}
                  className="relative h-12 w-12 opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent aria-current:opacity-100"
                >
                  <img
                    src={photoVariantUrl(baseUrl, frame, PHOTO_THUMBNAIL_WIDTH)}
                    alt=""
                    decoding="async"
                    draggable={false}
                    className="h-full w-full select-none object-cover"
                    style={{ backgroundColor: frame.placeholderColor }}
                  />
                  {frame.id === photo.id && (
                    <span
                      aria-hidden="true"
                      className="absolute -inset-1.5 -rotate-2 rounded-[3px] border-2 border-accent"
                    />
                  )}
                </button>
              ))}
            </nav>
          )}
          {navigation.status === "loading" ? (
            <span role="status">{t.loadingNeighbors}</span>
          ) : navigation.status === "error" ? (
            <span role="alert" className="flex items-center gap-3">
              {t.neighborsFailed}
              <button
                type="button"
                onClick={onRetryNavigation}
                className="rounded px-2 py-1 text-ink-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t.retry}
              </button>
            </span>
          ) : (
            <>
              <span className="hidden pointer-coarse:inline">{t.swipeHint}</span>
              <span className="pointer-coarse:hidden">{t.keyHint}</span>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
