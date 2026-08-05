import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { photoVariantUrl, type PhotoAlbum, type PhotoRecord } from "@/lib/photo-catalog";

type PhotoLightboxProps = {
  baseUrl: string;
  open: boolean;
  photo: PhotoRecord;
  photos: PhotoRecord[];
  albums: PhotoAlbum[];
  onClose: () => void;
  onSelect: (photo: PhotoRecord) => void;
};

function formatCapturedAt(capturedAt: string): string {
  const [date, timeWithOffset] = capturedAt.split("T");
  const [year, month, day] = date.split("-");
  const time = timeWithOffset.slice(0, 5);
  return `${year}年${Number(month)}月${Number(day)}日 ${time}`;
}

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
  photos,
  albums,
  onClose,
  onSelect,
}: PhotoLightboxProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const index = photos.findIndex((candidate) => candidate.id === photo.id);
  const currentPosition = index >= 0 ? index + 1 : 1;
  const previous = index > 0 ? photos[index - 1] : undefined;
  const next = index >= 0 && index < photos.length - 1 ? photos[index + 1] : undefined;
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        onSelect(previous);
      } else if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        onSelect(next);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [next, onSelect, open, previous]);

  useEffect(() => {
    if (!open) {
      return;
    }
    for (const neighbor of [previous, next]) {
      if (neighbor) {
        const image = new Image();
        image.src = photoVariantUrl(baseUrl, neighbor.id, 2048);
      }
    }
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
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }
    if (deltaX > 0 && previous) {
      onSelect(previous);
    } else if (deltaX < 0 && next) {
      onSelect(next);
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
        description={formatCapturedAt(photo.capturedAt)}
        finalFocus={getPhotoTile}
        backdropClassName="bg-[#101114]/90 backdrop-blur-md"
        className="photo-lightbox fixed inset-0 left-0 top-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-[#101114] p-0 text-[#f0efea] shadow-none"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-4 px-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-[#deddd8]">
              {formatCapturedAt(photo.capturedAt)}
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
            src={photoVariantUrl(baseUrl, photo.id, 2048)}
            srcSet={`${photoVariantUrl(baseUrl, photo.id, 960)} 960w, ${photoVariantUrl(baseUrl, photo.id, 2048)} 2048w`}
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
            {currentPosition} / {photos.length}
          </span>
          <span className="sm:hidden">左右滑动 · Esc 关闭</span>
          <span className="hidden sm:inline">← → 切换 · Esc 关闭</span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
