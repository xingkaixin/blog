import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { PhotoBrowsingNavigation } from "@/hooks/use-photo-browsing-session";
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
import { cn } from "@/lib/utils";

const LIGHTBOX_VARIANT_WIDTHS = [PHOTO_DISPLAY_WIDTH, PHOTO_FULL_WIDTH] as const;
const LIGHTBOX_IMAGE_SIZES = "100vw";
const LIGHTBOX_BUTTON_CLASS_NAME =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface/85 text-ink-800 transition-[transform,border-color] hover:border-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.96]";

type PhotoLightboxProps = {
  baseUrl: string;
  open: boolean;
  photo: PhotoRecord;
  navigation: PhotoBrowsingNavigation;
  albums: PhotoAlbum[];
  onClose: () => void;
  onSelect: (photo: PhotoRecord) => void;
  onRetryNavigation: () => void;
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

function loadedTileSource(photoId: string): string | undefined {
  const tile = document.querySelector<HTMLImageElement>(`[data-photo-id="${photoId}"] img`);
  return tile?.complete && tile.naturalWidth > 0 ? tile.currentSrc : undefined;
}

function LightboxImage({ baseUrl, photo }: { baseUrl: string; photo: PhotoRecord }) {
  const [previewSrc] = useState(
    () => loadedTileSource(photo.id) ?? photoVariantUrl(baseUrl, photo, PHOTO_THUMBNAIL_WIDTH),
  );
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="relative overflow-hidden"
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

export function PhotoLightbox({
  baseUrl,
  open,
  photo,
  navigation,
  albums,
  onClose,
  onSelect,
  onRetryNavigation,
}: PhotoLightboxProps) {
  const revealOnClose = useRef(false);
  const close = () => {
    revealOnClose.current = true;
    onClose();
  };
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const { previous, next } = navigation;
  const albumTitleById = useMemo(
    () => new Map(albums.map((album) => [album.id, album.title])),
    [albums],
  );
  const albumTitles = photo.albumIds
    .map((albumId) => albumTitleById.get(albumId))
    .filter((title): title is string => Boolean(title));
  const getPhotoTile = () => document.querySelector<HTMLElement>(`[data-photo-id="${photo.id}"]`);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    revealOnClose.current = false;
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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button === 0) {
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const selected = photoFromSwipe(deltaX, deltaY, previous, next);
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && close()}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen && revealOnClose.current) {
          revealOnClose.current = false;
          revealIfOutsideViewport(getPhotoTile());
        }
      }}
    >
      <DialogContent
        title="照片大图"
        description={formatPhotoCapturedAt(photo.capturedAt)}
        finalFocus={getPhotoTile}
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
        backdropClassName="bg-black/90 backdrop-blur-md"
        className="photo-lightbox fixed inset-0 left-0 top-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-black p-0 text-ink-800 shadow-none"
      >
        <div className="flex h-18 shrink-0 items-center justify-between gap-4 px-3 sm:px-6">
          <div className="min-w-0">
            {albumTitles.length > 0 && (
              <p className="mb-1.5 truncate font-serif text-xl font-black leading-none text-ink-800">
                {albumTitles.join("、")}
              </p>
            )}
            <p className="truncate font-mono text-xs text-ink-500">
              {formatPhotoCapturedAt(photo.capturedAt)}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭大图"
            onClick={close}
            className={cn("shrink-0", LIGHTBOX_BUTTON_CLASS_NAME)}
          >
            <XIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2 pb-2 [container-type:size] sm:px-16"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerStartRef.current = null;
          }}
        >
          <LightboxImage key={photo.id} baseUrl={baseUrl} photo={photo} />

          {previous && (
            <button
              type="button"
              aria-label="上一张照片"
              onClick={() => onSelect(previous)}
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 max-sm:not-focus:sr-only sm:left-5",
                LIGHTBOX_BUTTON_CLASS_NAME,
              )}
            >
              <CaretLeftIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
          {next && (
            <button
              type="button"
              aria-label="下一张照片"
              onClick={() => onSelect(next)}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 max-sm:not-focus:sr-only sm:right-5",
                LIGHTBOX_BUTTON_CLASS_NAME,
              )}
            >
              <CaretRightIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-3 py-2.5 font-mono text-[10px] text-ink-500 sm:px-6 sm:py-3">
          <span aria-live="polite" className="min-w-16 text-ink-700">
            {navigation.position} / {navigation.total}
          </span>
          {navigation.strip.length > 1 && (
            <nav aria-label="同一个月的照片" className="hidden gap-2 sm:flex">
              {navigation.strip.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  aria-label={`查看${formatPhotoCapturedAt(frame.capturedAt)}拍摄的照片`}
                  aria-current={frame.id === photo.id ? "true" : undefined}
                  onClick={() => frame.id !== photo.id && onSelect(frame)}
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
            <span role="status">正在加载相邻照片…</span>
          ) : navigation.status === "error" ? (
            <span role="alert" className="flex items-center gap-3">
              相邻照片加载失败
              <button
                type="button"
                onClick={onRetryNavigation}
                className="rounded px-2 py-1 text-ink-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                重试
              </button>
            </span>
          ) : (
            <>
              <span className="sm:hidden">左右滑动 · Esc 关闭</span>
              <span className="hidden sm:inline">← → 切换 · Esc 关闭</span>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
