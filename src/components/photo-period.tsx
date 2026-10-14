import { memo, useEffect, useEffectEvent, useMemo, useRef, type CSSProperties } from "react";
import { formatPhotoCapturedAt } from "@/lib/photo-captured-at";
import {
  PHOTO_THUMBNAIL_WIDTH,
  photoVariantSrcSet,
  photoVariantUrl,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import { buildJustifiedRows } from "@/lib/photo-layout";

type PhotoPeriodSectionProps = {
  baseUrl: string;
  period: PhotoPeriod;
  cities: string;
  monthCatalog?: PhotoMonthCatalog;
  albumId: string | null;
  error?: string;
  eager: boolean;
  containerWidth: number;
  onVisible: (period: PhotoPeriod) => void;
  onRetry: (period: PhotoPeriod) => void;
  onOpenPhoto: (photo: PhotoRecord) => void;
};

type PhotoGridProps = {
  baseUrl: string;
  photos: PhotoRecord[];
  eager: boolean;
  containerWidth: number;
  onOpenPhoto: (photo: PhotoRecord) => void;
};

type PhotoFrameStyle = CSSProperties & {
  "--photo-width": string;
  "--photo-height": string;
};

type PlaceholderStyle = CSSProperties & {
  "--photo-mobile-rows": number;
  "--photo-desktop-rows": number;
};

// 接触印相面板的左右内边距（px），排版宽度要扣掉它
const SHEET_PADDING = 14;
const FRAME_GAP = 6;

function formatMonth(month: string): string {
  return month.replace("-", ".");
}

function formatFrameTime(capturedAt: string): string {
  return `${capturedAt.slice(5, 10).replace("-", ".")} ${capturedAt.slice(11, 16)}`;
}

export const PhotoPeriodSection = memo(function PhotoPeriodSection({
  baseUrl,
  period,
  cities,
  monthCatalog,
  albumId,
  error,
  eager,
  containerWidth,
  onVisible,
  onRetry,
  onOpenPhoto,
}: PhotoPeriodSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const requestVisible = useEffectEvent(() => onVisible(period));
  const expectedCount = albumId ? (period.albumCounts[albumId] ?? 0) : period.count;
  const photos = useMemo(
    () =>
      monthCatalog?.photos.filter((photo) => !albumId || photo.albumIds.includes(albumId)) ?? [],
    [albumId, monthCatalog],
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || monthCatalog || error) {
      return undefined;
    }
    if (!("IntersectionObserver" in window)) {
      requestVisible();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestVisible();
        }
      },
      { rootMargin: "1400px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [error, monthCatalog, period]);

  return (
    <section
      ref={sectionRef}
      id={`photo-month-${period.month}`}
      data-photo-month={period.month}
      className="scroll-mt-28"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1">
          <h2 className="font-mono text-2xl font-medium tracking-tight text-ink-800 sm:text-[32px]">
            {formatMonth(period.month)}
          </h2>
          {cities && (
            <span className="font-serif text-lg font-semibold text-ink-700 sm:text-xl">
              {cities}
            </span>
          )}
        </div>
        <span className="font-mono text-xs text-ink-500">{expectedCount} 张</span>
      </div>

      <div className="flex flex-col gap-3 rounded-[6px] bg-surface p-1.5 md:px-3.5 md:pb-4 md:pt-3">
        <span aria-hidden="true" className="film-sprockets hidden md:block" />
        {monthCatalog ? (
          <PhotoGrid
            baseUrl={baseUrl}
            photos={photos}
            eager={eager}
            containerWidth={containerWidth}
            onOpenPhoto={onOpenPhoto}
          />
        ) : error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 text-center">
            <p className="text-sm text-ink-600">这个月份的照片暂时无法加载。</p>
            <button
              type="button"
              onClick={() => onRetry(period)}
              className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink-700 transition-[transform,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]"
            >
              重试
            </button>
          </div>
        ) : (
          <PhotoPeriodPlaceholder count={expectedCount} />
        )}
      </div>
    </section>
  );
});

function PhotoPeriodPlaceholder({ count }: { count: number }) {
  const style: PlaceholderStyle = {
    "--photo-mobile-rows": Math.max(1, Math.ceil(count / 3)),
    "--photo-desktop-rows": Math.max(1, Math.ceil(count / 4)),
  };

  return (
    <div
      role="status"
      aria-label="正在加载这个月份的照片"
      className="photo-period-placeholder grid grid-cols-3 gap-0.5 md:grid-cols-4 md:gap-1"
      style={style}
    >
      {Array.from({ length: Math.min(12, Math.max(3, count)) }, (_, index) => (
        <span key={index} aria-hidden="true" className="aspect-square bg-ink-100 even:bg-ink-50" />
      ))}
    </div>
  );
}

function PhotoGrid({ baseUrl, photos, eager, containerWidth, onOpenPhoto }: PhotoGridProps) {
  const rows = useMemo(() => {
    const sheetWidth = containerWidth - SHEET_PADDING * 2;
    const targetRowHeight = Math.min(300, Math.max(200, sheetWidth / 5));
    return buildJustifiedRows(photos, {
      containerWidth: sheetWidth,
      targetRowHeight,
      gap: FRAME_GAP,
    });
  }, [containerWidth, photos]);
  // 片号按拍摄先后递增，最新一张号码最大
  const frameNumbers = useMemo(
    () => new Map(photos.map((photo, index) => [photo.id, photos.length - index])),
    [photos],
  );

  return (
    <div className="photo-gallery">
      {containerWidth === 0 ? (
        <PhotoPeriodPlaceholder count={photos.length} />
      ) : (
        rows.map((row, rowIndex) => (
          <div key={row.items[0]?.photo.id ?? "empty-row"} className="photo-row">
            {row.items.map((item, itemIndex) => {
              const photo = item.photo;
              const style: PhotoFrameStyle = {
                "--photo-width": `${item.width}px`,
                "--photo-height": `${item.height}px`,
              };
              const loadEagerly = eager && rowIndex === 0 && itemIndex < 4;

              return (
                <figure key={photo.id} className="photo-frame" style={style}>
                  <button
                    type="button"
                    className="photo-tile group relative block overflow-hidden focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:opacity-90"
                    style={{ backgroundColor: photo.placeholderColor }}
                    data-photo-id={photo.id}
                    aria-label={`查看${formatPhotoCapturedAt(photo.capturedAt)}拍摄的照片`}
                    onClick={() => onOpenPhoto(photo)}
                  >
                    <img
                      src={photoVariantUrl(baseUrl, photo, PHOTO_THUMBNAIL_WIDTH)}
                      srcSet={photoVariantSrcSet(baseUrl, photo)}
                      sizes={`(max-width: 767px) 33vw, ${item.width}px`}
                      alt=""
                      width={photo.width}
                      height={photo.height}
                      loading={loadEagerly ? "eager" : "lazy"}
                      fetchPriority={loadEagerly ? "high" : "auto"}
                      decoding="async"
                      draggable={false}
                      onLoad={(event) => event.currentTarget.setAttribute("data-loaded", "")}
                      className="h-full w-full select-none object-cover"
                    />
                  </button>
                  <figcaption
                    aria-hidden="true"
                    className="hidden gap-2 overflow-hidden whitespace-nowrap font-mono text-[10px] tracking-[0.06em] md:flex"
                  >
                    <span className="text-film">
                      {String(frameNumbers.get(photo.id)).padStart(2, "0")}
                    </span>
                    <span className="text-ink-500">{formatFrameTime(photo.capturedAt)}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
