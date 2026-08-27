import { PHOTO_THUMBNAIL_WIDTH, photoVariantUrl, type PhotoPeriod } from "@/lib/photo-catalog";
import type { AlbumOverviewItem } from "@/lib/photo-wall-model";
import { cn } from "@/lib/utils";

type PhotoOverviewProps = {
  baseUrl: string;
  albumCount: number;
  items: AlbumOverviewItem[];
  failedPeriods: PhotoPeriod[];
  onRetryMonth: (period: PhotoPeriod) => void;
  onOpenAlbum: (albumId: string | null) => void;
};

export function PhotoOverview({
  baseUrl,
  albumCount,
  items,
  failedPeriods,
  onRetryMonth,
  onOpenAlbum,
}: PhotoOverviewProps) {
  return (
    <div className="mx-auto max-w-320 px-3 pt-8 sm:px-5 lg:px-8 lg:pt-[30px]">
      <PhotoArchiveHeader detail={`${albumCount} 个相册 · ${items[0]?.count ?? 0} 张照片`} />
      {failedPeriods.length > 0 && (
        <div
          role="alert"
          className="mt-6 flex items-center justify-between gap-4 rounded-[8px] border border-line bg-surface px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-ink-800">相册预览加载失败</p>
            <p className="mt-1 text-xs text-ink-500">请检查网络后重试。</p>
          </div>
          <button
            type="button"
            onClick={() => failedPeriods.forEach(onRetryMonth)}
            className="shrink-0 rounded-[6px] border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            重试预览
          </button>
        </div>
      )}
      <div className="mt-[26px] grid gap-[26px] sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <AlbumOverviewCard
            key={item.id ?? "all"}
            baseUrl={baseUrl}
            item={item}
            eager={index < 3}
            onOpen={() => onOpenAlbum(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function PhotoWallLoading() {
  return (
    <div className="mx-auto max-w-320 px-3 pt-8 sm:px-5 lg:px-8 lg:pt-[30px]">
      <PhotoArchiveHeader />
      <div
        aria-label="正在加载相册"
        className="mt-[26px] grid gap-[26px] sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index}>
            <span aria-hidden="true" className="block aspect-4/3 rounded-[12px] bg-ink-100" />
            <span aria-hidden="true" className="mt-3 block h-4 w-24 bg-ink-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhotoWallError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-320 px-3 pt-8 sm:px-5 lg:px-8 lg:pt-[30px]">
      <PhotoArchiveHeader />
      <div
        role="alert"
        className="mt-8 flex min-h-72 flex-col items-center justify-center gap-4 rounded-[10px] border border-line bg-surface px-6 text-center"
      >
        <div>
          <h2 className="text-lg font-medium text-ink-800">照片暂时无法加载</h2>
          <p className="mt-2 text-sm leading-7 text-ink-500">{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[6px] bg-ink-800 px-4 py-2 text-sm font-medium text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.97]"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}

function PhotoArchiveHeader({ detail }: { detail?: string }) {
  return (
    <header className="flex flex-col gap-3 border-b border-line pb-[18px] sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
          {detail ?? "正在读取照片档案"}
        </p>
        <h1 className="mt-2 font-display text-4xl font-normal leading-none text-ink-800">照片墙</h1>
      </div>
      <p className="text-[13px] leading-6 text-ink-500">按拍摄时间，从最近的照片开始。</p>
    </header>
  );
}

function AlbumOverviewCard({
  baseUrl,
  item,
  eager,
  onOpen,
}: {
  baseUrl: string;
  item: AlbumOverviewItem;
  eager: boolean;
  onOpen: () => void;
}) {
  const placements = [
    "left-[12%] top-[14%] h-[56%] w-[52%] -rotate-7",
    "right-[10%] top-[8%] h-[44%] w-[46%] rotate-6",
    "bottom-[8%] left-[22%] h-[42%] w-[44%] rotate-4",
    "right-[8%] bottom-[12%] h-[40%] w-[38%] -rotate-4",
  ];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-[8px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      aria-label={`打开${item.title}，${item.count}张照片`}
    >
      <span className="relative block aspect-4/3 overflow-hidden rounded-[12px] border border-line bg-surface">
        {(item.photos.length > 0 ? item.photos : [null, null, null, null]).map((photo, index) => (
          <span
            key={photo?.id ?? index}
            className={cn(
              "absolute overflow-hidden border-4 border-white bg-ink-100 shadow-[0_8px_22px_-10px_rgba(20,21,26,0.55)] transition-transform duration-(--duration-fast) ease-(--ease-smooth-out) group-hover:scale-[1.02]",
              placements[index],
            )}
          >
            {photo && (
              <img
                src={photoVariantUrl(baseUrl, photo, PHOTO_THUMBNAIL_WIDTH)}
                alt=""
                width={photo.width}
                height={photo.height}
                loading={eager ? "eager" : "lazy"}
                fetchPriority={eager ? "high" : "auto"}
                decoding="async"
                className="h-full w-full object-cover"
                style={{ backgroundColor: photo.placeholderColor }}
              />
            )}
          </span>
        ))}
      </span>
      <span className="mt-3 flex items-baseline justify-between gap-4 px-1">
        <span className="text-[15px] font-medium text-ink-800 transition-colors group-hover:text-accent">
          {item.title}
        </span>
        <span className="font-mono text-[10px] text-ink-400">{item.count} 张</span>
      </span>
      <span className="mt-0.5 block px-1 font-mono text-[9px] tracking-[0.08em] text-ink-300">
        {item.meta}
      </span>
    </button>
  );
}
