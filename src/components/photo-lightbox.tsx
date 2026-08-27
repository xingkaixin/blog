import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { PhotoBrowsingNavigation } from "@/hooks/use-photo-browsing-session";
import { formatPhotoCapturedAt } from "@/lib/photo-captured-at";
import {
  PHOTO_DISPLAY_WIDTH,
  PHOTO_FULL_WIDTH,
  photoVariantSrcSet,
  photoVariantUrl,
  type PhotoAlbum,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import { photoFromArrow, photoFromSwipe, planPhotoPreload } from "@/lib/photo-preload";

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
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const plan = planPhotoPreload(previous, next, window.innerWidth, connection);
    if (!plan || document.visibilityState !== "visible") {
      return undefined;
    }
    const preload = () => {
      const image = new Image();
      image.src = photoVariantUrl(baseUrl, plan.photo, plan.width);
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
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      onOpenChangeComplete={(nextOpen) => !nextOpen && revealIfOutsideViewport(getPhotoTile())}
    >
      <DialogContent
        hideClose
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
        backdropClassName="bg-[#101114]/90 backdrop-blur-md"
        className="photo-lightbox fixed inset-0 left-0 top-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-[#101114] p-0 text-[#f0efea] shadow-none"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-4 px-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-[#deddd8]">
              {formatPhotoCapturedAt(photo.capturedAt)}
            </p>
            {albumTitles.length > 0 && (
              <p className="mt-1 truncate text-xs text-[#8b8c92]">{albumTitles.join("、")}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="关闭大图"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 text-[#f0efea] transition-[transform,background-color] hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5644e] active:scale-[0.96]"
          >
            <XIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2 pb-2 sm:px-16"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerStartRef.current = null;
          }}
        >
          <img
            key={photo.id}
            // key 重挂载会在新图就绪前留一帧空白，用照片主色兜底
            style={{ backgroundColor: photo.placeholderColor }}
            src={photoVariantUrl(baseUrl, photo, PHOTO_FULL_WIDTH)}
            srcSet={photoVariantSrcSet(baseUrl, photo, [PHOTO_DISPLAY_WIDTH, PHOTO_FULL_WIDTH])}
            sizes="100vw"
            alt=""
            width={photo.width}
            height={photo.height}
            decoding="async"
            draggable={false}
            className="max-h-full max-w-full select-none object-contain"
          />

          {previous && (
            <button
              type="button"
              aria-label="上一张照片"
              onClick={() => onSelect(previous)}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#1c1d23]/85 text-[#f0efea] transition-[transform,background-color] hover:bg-[#2b2c33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5644e] active:scale-[0.96] sm:inline-flex"
            >
              <ChevronLeftIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
          {next && (
            <button
              type="button"
              aria-label="下一张照片"
              onClick={() => onSelect(next)}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#1c1d23]/85 text-[#f0efea] transition-[transform,background-color] hover:bg-[#2b2c33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5644e] active:scale-[0.96] sm:inline-flex"
            >
              <ChevronRightIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
        </div>

        <footer className="flex h-10 shrink-0 items-center justify-between gap-4 border-t border-white/10 px-3 font-mono text-[10px] text-[#8b8c92] sm:px-5">
          <span aria-live="polite" className="text-[#deddd8]">
            {navigation.position} / {navigation.total}
          </span>
          {navigation.status === "loading" ? (
            <span role="status">正在加载相邻照片…</span>
          ) : navigation.status === "error" ? (
            <span role="alert" className="flex items-center gap-3">
              相邻照片加载失败
              <button
                type="button"
                onClick={onRetryNavigation}
                className="rounded px-2 py-1 text-[#f0efea] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5644e]"
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
