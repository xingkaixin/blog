import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { useLayoutEffect, useState, type RefObject } from "react";
import { PhotoPeriodSection } from "@/components/photo-period";
import { PhotoTimeRail } from "@/components/photo-time-rail";
import type { PhotoMonthCatalog, PhotoPeriod, PhotoRecord } from "@/lib/photo-catalog";
import type { PhotoTimelineModel } from "@/lib/photo-wall-model";
import { cn } from "@/lib/utils";

const ALBUM_CHIP_CLASS_NAME =
  "shrink-0 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800 aria-pressed:border-ink-800 aria-pressed:bg-ink-800 aria-pressed:text-paper";
const ALBUM_SIDEBAR_CLASS_NAME =
  "flex w-full items-center justify-between gap-3 rounded-[6px] px-2 py-1.5 text-left text-[13px] text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800 aria-pressed:bg-ink-100 aria-pressed:font-medium aria-pressed:text-ink-800 [&>span:last-child]:font-mono [&>span:last-child]:text-[9px] [&>span:last-child]:text-ink-400";

type PhotoTimelineProps = {
  baseUrl: string;
  model: PhotoTimelineModel;
  monthCatalogs: Record<string, PhotoMonthCatalog>;
  monthErrors: Record<string, string>;
  activeMonth: string;
  wallRef: RefObject<HTMLDivElement | null>;
  onReturn: () => void;
  onSelectAlbum: (albumId: string | null) => void;
  onLoadMonth: (period: PhotoPeriod) => void;
  onRetryMonth: (period: PhotoPeriod) => void;
  onOpenPhoto: (photo: PhotoRecord) => void;
  onJumpMonth: (month: string) => void;
};

export function PhotoTimeline({
  baseUrl,
  model,
  monthCatalogs,
  monthErrors,
  activeMonth,
  wallRef,
  onReturn,
  onSelectAlbum,
  onLoadMonth,
  onRetryMonth,
  onOpenPhoto,
  onJumpMonth,
}: PhotoTimelineProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const {
    selectedAlbumId,
    selectedAlbum,
    albumSummaries,
    visiblePeriods,
    allPhotoCount,
    totalPhotoCount,
    timelineRange,
  } = model;

  useLayoutEffect(() => {
    const wall = wallRef.current;
    if (!wall) {
      return undefined;
    }

    const updateWidth = (width: number) => {
      const roundedWidth = Math.round(width);
      setContainerWidth((current) =>
        Math.abs(current - roundedWidth) >= 2 ? roundedWidth : current,
      );
    };

    const style = window.getComputedStyle(wall);
    updateWidth(
      wall.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0),
    );
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) {
        updateWidth(width);
      }
    });
    observer.observe(wall);
    return () => observer.disconnect();
  }, [wallRef]);

  return (
    <>
      <div className="mx-auto max-w-320">
        <header className="flex flex-wrap items-center gap-2.5 border-b border-line px-3 py-3 sm:px-6">
          <button
            type="button"
            onClick={onReturn}
            className="inline-flex items-center gap-1.5 rounded-[5px] text-[13px] text-ink-500 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ArrowLeftIcon aria-hidden="true" className="h-3.5 w-3.5" />
            相册
          </button>
          <span aria-hidden="true" className="text-line">
            /
          </span>
          <h1 className="text-[15px] font-medium text-ink-800">{selectedAlbum?.title ?? "全部"}</h1>
          <span className="font-mono text-[10px] text-ink-400">
            {totalPhotoCount} 张{timelineRange && ` · ${timelineRange}`}
          </span>
        </header>

        <div
          role="group"
          aria-label="切换相册"
          className="flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2.5 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-pressed={selectedAlbumId === null}
            onClick={() => onSelectAlbum(null)}
            className={ALBUM_CHIP_CLASS_NAME}
          >
            全部
          </button>
          {albumSummaries.map((album) => (
            <button
              key={album.id}
              type="button"
              aria-pressed={selectedAlbumId === album.id}
              onClick={() => onSelectAlbum(album.id)}
              className={ALBUM_CHIP_CLASS_NAME}
            >
              {album.title}
            </button>
          ))}
        </div>

        <div className="lg:grid lg:min-h-[680px] lg:grid-cols-[220px_minmax(0,1fr)_56px]">
          <aside className="hidden border-r border-line px-[18px] py-5 lg:flex lg:flex-col">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">相册</p>
            <div role="group" aria-label="切换相册" className="mt-2 space-y-0.5">
              <button
                type="button"
                aria-pressed={selectedAlbumId === null}
                onClick={() => onSelectAlbum(null)}
                className={ALBUM_SIDEBAR_CLASS_NAME}
              >
                <span>全部照片</span>
                <span>{allPhotoCount}</span>
              </button>
              {albumSummaries.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  aria-pressed={selectedAlbumId === album.id}
                  onClick={() => onSelectAlbum(album.id)}
                  className={ALBUM_SIDEBAR_CLASS_NAME}
                >
                  <span>{album.title}</span>
                  <span>{album.count}</span>
                </button>
              ))}
            </div>
            <p className="mt-auto border-t border-line pt-4 font-mono text-[10px] leading-5 text-ink-400">
              {totalPhotoCount} 张 · {timelineRange}
              <br />
              按拍摄时间倒序
            </p>
          </aside>

          <div
            ref={wallRef}
            className={cn(
              "min-w-0 py-[18px]",
              visiblePeriods.length > 1
                ? "pr-8 sm:px-5 sm:pr-12 lg:px-5 lg:pr-5"
                : "sm:px-5 lg:px-5",
            )}
          >
            {visiblePeriods.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center border-y border-line bg-surface px-6 text-center sm:rounded-[10px] sm:border">
                <div>
                  <h2 className="text-lg font-medium text-ink-800">
                    {selectedAlbumId ? "这个相册还没有照片" : "还没有照片"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-ink-500">
                    新照片发布后会按拍摄时间显示在这里。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-9 md:space-y-12">
                {visiblePeriods.map((period, indexInList) => (
                  <PhotoPeriodSection
                    key={`${selectedAlbumId ?? "all"}-${period.month}`}
                    baseUrl={baseUrl}
                    period={period}
                    monthCatalog={monthCatalogs[period.month]}
                    albumId={selectedAlbumId}
                    error={monthErrors[period.month]}
                    eager={indexInList === 0}
                    containerWidth={containerWidth}
                    onVisible={() => onLoadMonth(period)}
                    onRetry={() => onRetryMonth(period)}
                    onOpenPhoto={onOpenPhoto}
                  />
                ))}
              </div>
            )}
          </div>
          <div aria-hidden="true" className="hidden justify-center py-6 lg:flex">
            <span className="w-px bg-line opacity-50" />
          </div>
        </div>
      </div>

      {visiblePeriods.length > 1 && (
        <PhotoTimeRail periods={visiblePeriods} activeMonth={activeMonth} onSelect={onJumpMonth} />
      )}
    </>
  );
}
