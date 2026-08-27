import { useEffect, useMemo, useRef, type CSSProperties } from "react";
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
  monthCatalog?: PhotoMonthCatalog;
  albumId: string | null;
  error?: string;
  eager: boolean;
  containerWidth: number;
  onVisible: () => void;
  onRetry: () => void;
  onOpenPhoto: (photo: PhotoRecord) => void;
};

type PhotoGridProps = {
  baseUrl: string;
  photos: PhotoRecord[];
  eager: boolean;
  containerWidth: number;
  onOpenPhoto: (photo: PhotoRecord) => void;
};

type PhotoTileStyle = CSSProperties & {
  "--photo-width": string;
  "--photo-height": string;
};

type PlaceholderStyle = CSSProperties & {
  "--photo-mobile-rows": number;
  "--photo-desktop-rows": number;
};

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${year} 年 ${Number(monthNumber)} 月`;
}

export function PhotoPeriodSection({
  baseUrl,
  period,
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
      onVisible();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible();
          observer.disconnect();
        }
      },
      { rootMargin: "1400px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [error, monthCatalog, onVisible]);

  return (
    <section
      ref={sectionRef}
      id={`photo-month-${period.month}`}
      data-photo-month={period.month}
      className="scroll-mt-28"
    >
      <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-line px-3 pb-2 sm:px-0">
        <h2 className="font-mono text-xs font-medium text-ink-700">{formatMonth(period.month)}</h2>
        <span className="font-mono text-[0.65rem] text-ink-400">{expectedCount} 张</span>
      </div>

      {monthCatalog ? (
        <PhotoGrid
          baseUrl={baseUrl}
          photos={photos}
          eager={eager}
          containerWidth={containerWidth}
          onOpenPhoto={onOpenPhoto}
        />
      ) : error ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 border border-line bg-surface px-5 text-center">
          <p className="text-sm text-ink-600">这个月份的照片暂时无法加载。</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-[6px] border border-line bg-paper px-4 py-2 text-sm font-medium text-ink-700 transition-[transform,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]"
          >
            重试
          </button>
        </div>
      ) : (
        <PhotoPeriodPlaceholder count={expectedCount} />
      )}
    </section>
  );
}

function PhotoPeriodPlaceholder({ count }: { count: number }) {
  const style: PlaceholderStyle = {
    "--photo-mobile-rows": Math.max(1, Math.ceil(count / 3)),
    "--photo-desktop-rows": Math.max(1, Math.ceil(count / 4)),
  };

  return (
    <div
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
    const targetRowHeight = Math.min(300, Math.max(200, containerWidth / 5));
    return buildJustifiedRows(photos, {
      containerWidth,
      targetRowHeight,
      gap: 4,
    });
  }, [containerWidth, photos]);

  return (
    <div className="photo-gallery">
      {containerWidth === 0 ? (
        <PhotoPeriodPlaceholder count={photos.length} />
      ) : (
        rows.map((row, rowIndex) => (
          <div key={row.items[0]?.photo.id ?? "empty-row"} className="photo-row">
            {row.items.map((item, itemIndex) => {
              const photo = item.photo;
              const style: PhotoTileStyle = {
                "--photo-width": `${item.width}px`,
                "--photo-height": `${item.height}px`,
                backgroundColor: photo.placeholderColor,
              };
              const loadEagerly = eager && rowIndex === 0 && itemIndex < 4;

              return (
                <button
                  key={photo.id}
                  type="button"
                  className="photo-tile group relative block overflow-hidden focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:opacity-90"
                  style={style}
                  data-photo-id={photo.id}
                  aria-label={`查看${formatPhotoCapturedAt(photo.capturedAt)}拍摄的照片`}
                  onClick={() => onOpenPhoto(photo)}
                >
                  <img
                    src={photoVariantUrl(baseUrl, photo, PHOTO_THUMBNAIL_WIDTH)}
                    srcSet={photoVariantSrcSet(baseUrl, photo)}
                    sizes="(max-width: 767px) 33vw, (max-width: 1199px) 34vw, 360px"
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
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
