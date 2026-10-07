import { useLayoutEffect, useState, type RefObject } from "react";
import { PhotoArchiveHeader } from "@/components/photo-overview";
import { PhotoPeriodSection } from "@/components/photo-period";
import { PhotoTimeRail } from "@/components/photo-time-rail";
import { photoBackgroundStyle } from "@/lib/photo-background";
import type { PhotoMonthCatalog, PhotoPeriod, PhotoRecord } from "@/lib/photo-catalog";
import type { PhotoTimelineModel } from "@/lib/photo-wall-model";
import { cn } from "@/lib/utils";

const COMPANION_CHIP_CLASS_NAME =
  "flex min-h-10 shrink-0 items-center gap-1.5 rounded-[6px] border border-line bg-surface px-3.5 text-sm text-ink-800 transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 aria-pressed:border-ink-800 aria-pressed:bg-ink-800 aria-pressed:text-paper [&>span]:font-mono [&>span]:text-[11px] [&>span]:text-ink-500 aria-pressed:[&>span]:text-ink-200";

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
    companionAlbums,
    visiblePeriods,
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
      <div className="mx-auto max-w-320 px-4 pt-2 sm:px-5 sm:pt-8 lg:px-8">
        {selectedAlbum ? (
          <>
            <nav aria-label="位置" className="flex items-center gap-2.5 text-sm text-ink-500">
              <button
                type="button"
                onClick={onReturn}
                className="inline-flex min-h-11 items-center rounded-[5px] transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                ← 照片墙
              </button>
              <span aria-hidden="true" className="text-ink-200">
                /
              </span>
              <span className="text-ink-800">{selectedAlbum.title}</span>
            </nav>
            <header className="relative mt-2 h-[210px] overflow-hidden rounded-[12px] border border-line bg-surface sm:mt-4 sm:h-[420px] sm:rounded-[14px]">
              <span
                aria-hidden="true"
                className="photo-sketch"
                style={{
                  ...photoBackgroundStyle(selectedAlbum.id),
                  backgroundPosition: "center 70%",
                }}
              />
              <div className="absolute inset-x-0 top-[30px] flex flex-col items-center gap-2.5 px-4 text-center sm:top-[72px] sm:gap-3.5">
                <h1 className="font-display text-[52px] font-normal leading-none text-ink-800 sm:text-[88px]">
                  {selectedAlbum.title}
                </h1>
                <p className="font-mono text-[11px] tracking-[0.16em] text-ink-600 sm:text-xs">
                  {timelineRange && `${timelineRange} · `}
                  {totalPhotoCount} 张
                </p>
              </div>
            </header>
            {companionAlbums.length > 1 && (
              <section
                aria-label="同期城市"
                className="mt-5 flex flex-col gap-2.5 border-y border-line py-4 sm:mt-8 sm:flex-row sm:items-center sm:gap-5"
              >
                <span className="shrink-0 font-mono text-[11px] tracking-[0.16em] text-ink-500">
                  同期城市
                </span>
                <div
                  role="group"
                  aria-label="切换相册"
                  className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
                >
                  {companionAlbums.map((album) => (
                    <button
                      key={album.id}
                      type="button"
                      aria-pressed={selectedAlbumId === album.id}
                      onClick={() => onSelectAlbum(album.id)}
                      className={COMPANION_CHIP_CLASS_NAME}
                    >
                      {album.title}
                      <span>{album.count}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="pt-6 sm:pt-0 lg:pt-4">
            <PhotoArchiveHeader
              detail={`${totalPhotoCount} 张${timelineRange ? ` · ${timelineRange}` : ""} · 按拍摄时间倒序`}
              view="timeline"
              onSwitchView={onReturn}
            />
          </div>
        )}

        <div
          ref={wallRef}
          className={cn("min-w-0 py-6 sm:py-8", visiblePeriods.length > 1 && "pr-6 md:pr-10")}
        >
          {visiblePeriods.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-2.5 rounded-[10px] border border-dashed border-ink-200 px-6 text-center">
              <h2 className="text-[17px] font-medium text-ink-800">
                {selectedAlbumId ? "这个相册还没有照片" : "还没有照片"}
              </h2>
              <p className="text-[13px] text-ink-500">新照片发布后会按拍摄时间出现在这里。</p>
              {selectedAlbumId && (
                <button
                  type="button"
                  onClick={onReturn}
                  className="mt-1 min-h-10 rounded-[5px] text-[13px] font-medium text-ink-800 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  ← 回到照片墙
                </button>
              )}
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
                  onVisible={onLoadMonth}
                  onRetry={onRetryMonth}
                  onOpenPhoto={onOpenPhoto}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {visiblePeriods.length > 1 && (
        <PhotoTimeRail periods={visiblePeriods} activeMonth={activeMonth} onSelect={onJumpMonth} />
      )}
    </>
  );
}
