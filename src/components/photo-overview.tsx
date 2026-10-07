import { photoBackgroundStyle } from "@/lib/photo-background";
import {
  PHOTO_THUMBNAIL_WIDTH,
  photoVariantUrl,
  type PhotoPeriod,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import type { AlbumOverviewItem, JourneyYear } from "@/lib/photo-wall-model";
import { cn } from "@/lib/utils";

type PhotoOverviewProps = {
  baseUrl: string;
  albumCount: number;
  photoCount: number;
  photoRange: string;
  items: AlbumOverviewItem[];
  journeyYears: JourneyYear[];
  failedPeriods: PhotoPeriod[];
  onRetryMonth: (period: PhotoPeriod) => void;
  onOpenAlbum: (albumId: string | null) => void;
};

const PAGE_CLASS_NAME = "mx-auto max-w-320 px-4 pt-8 sm:px-5 lg:px-8 lg:pt-12";
const FOCUS_RING_CLASS_NAME =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const FEATURED_PRINT_CLASS_NAMES = [
  "left-[14%] top-[13%] h-[68%] max-w-[36%] -rotate-4 sm:left-[44%] sm:top-[15%] sm:h-[64%] sm:max-w-[22%]",
  "left-[48%] top-[9%] h-[72%] max-w-[38%] rotate-3 sm:left-[61%] sm:top-[9%] sm:h-[69%] sm:max-w-[22%] sm:rotate-2",
  "hidden sm:block sm:left-[79%] sm:top-[22%] sm:h-[60%] sm:max-w-[19%] sm:rotate-5",
];

export function PhotoOverview({
  baseUrl,
  albumCount,
  photoCount,
  photoRange,
  items,
  journeyYears,
  failedPeriods,
  onRetryMonth,
  onOpenAlbum,
}: PhotoOverviewProps) {
  const [featured, ...rest] = items;
  return (
    <div className={PAGE_CLASS_NAME}>
      <PhotoArchiveHeader
        detail={`PHOTOS · ${albumCount} 个相册 · ${photoCount} 张`}
        view="overview"
        onSwitchView={() => onOpenAlbum(null)}
      />
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
            className={cn(
              "shrink-0 rounded-[6px] border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-700",
              FOCUS_RING_CLASS_NAME,
            )}
          >
            重试预览
          </button>
        </div>
      )}
      {featured && (
        <FeaturedAlbumCard
          baseUrl={baseUrl}
          item={featured}
          onOpen={() => onOpenAlbum(featured.id)}
        />
      )}
      <section className="mt-12 sm:mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium text-ink-800 sm:text-xl">城市</h2>
          <p className="text-[13px] text-ink-500">按最近一次到访排序</p>
        </div>
        <div className="mt-5 grid gap-x-7 gap-y-8 sm:mt-6 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3">
          {rest.map((item, index) => (
            <AlbumCard
              key={item.id}
              baseUrl={baseUrl}
              item={item}
              eager={index < 3}
              onOpen={() => onOpenAlbum(item.id)}
            />
          ))}
          <AllPhotosCard count={photoCount} range={photoRange} onOpen={() => onOpenAlbum(null)} />
        </div>
      </section>
      {journeyYears.length > 0 && <JourneyYears years={journeyYears} onOpenAlbum={onOpenAlbum} />}
    </div>
  );
}

export function PhotoWallLoading() {
  return (
    <div className={PAGE_CLASS_NAME}>
      <PhotoArchiveHeader />
      <div role="status" aria-label="正在加载相册">
        <span
          aria-hidden="true"
          className="mt-8 block h-[260px] rounded-[12px] bg-ink-100 sm:mt-14 sm:h-[440px] sm:rounded-[14px]"
        />
        <div className="mt-12 grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index}>
              <span aria-hidden="true" className="block aspect-3/2 rounded-[12px] bg-ink-100" />
              <span aria-hidden="true" className="mt-3 block h-4 w-24 bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PhotoWallError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={PAGE_CLASS_NAME}>
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

export function PhotoArchiveHeader({
  detail,
  view,
  onSwitchView,
}: {
  detail?: string;
  view?: "overview" | "timeline";
  onSwitchView?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {detail ?? "正在读取照片档案"}
        </p>
        <h1 className="mt-2.5 font-display text-[44px] font-normal leading-none text-ink-800 sm:text-[56px]">
          照片墙
        </h1>
      </div>
      {view && (
        <div
          role="group"
          aria-label="浏览方式"
          className="flex self-start rounded-[8px] border border-line bg-surface p-1 sm:self-auto"
        >
          <ViewSwitchButton
            pressed={view === "overview"}
            label="按城市"
            onClick={view === "overview" ? undefined : onSwitchView}
          />
          <ViewSwitchButton
            pressed={view === "timeline"}
            label="按时间"
            onClick={view === "timeline" ? undefined : onSwitchView}
          />
        </div>
      )}
    </header>
  );
}

function ViewSwitchButton({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-[6px] px-3.5 text-[13px] text-ink-500 transition-colors hover:text-ink-800 aria-pressed:bg-ink-800 aria-pressed:text-paper",
        FOCUS_RING_CLASS_NAME,
      )}
    >
      {label}
    </button>
  );
}

function FeaturedAlbumCard({
  baseUrl,
  item,
  onOpen,
}: {
  baseUrl: string;
  item: AlbumOverviewItem;
  onOpen: () => void;
}) {
  const label = (
    <>
      <span className="font-mono text-[11px] tracking-[0.18em] text-accent">最近一次出发</span>
      <span className="font-display text-[40px] leading-none text-ink-800 transition-colors group-hover:text-accent sm:text-[64px]">
        {item.title}
      </span>
    </>
  );
  const meta = `${item.latestMonth} · ${item.count} 张`;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开${item.title}，${item.count}张照片`}
      className={cn(
        "group mt-8 block w-full rounded-[14px] text-left sm:mt-14",
        FOCUS_RING_CLASS_NAME,
      )}
    >
      <span className="relative block h-[260px] overflow-hidden rounded-[12px] border border-line bg-surface sm:h-[440px] sm:rounded-[14px]">
        <span aria-hidden="true" className="photo-sketch" style={photoBackgroundStyle(item.id)} />
        {FEATURED_PRINT_CLASS_NAMES.map((className, index) => (
          <PhotoPrint
            key={item.photos[index]?.id ?? index}
            baseUrl={baseUrl}
            photo={item.photos[index]}
            status={item.status}
            eager
            fallbackAspect="3 / 4"
            className={className}
          />
        ))}
        <span className="absolute left-8 top-8 hidden min-w-60 flex-col gap-2.5 rounded-[10px] border border-line bg-paper/95 px-[26px] py-[22px] sm:flex">
          {label}
          <span className="font-mono text-xs text-ink-500">{meta}</span>
          <span className="mt-2 text-sm font-medium text-ink-800">进入相册 →</span>
        </span>
      </span>
      <span className="mt-3.5 flex items-end justify-between gap-3 sm:hidden">
        <span className="flex flex-col gap-1.5">{label}</span>
        <span className="font-mono text-xs text-ink-500">{meta}</span>
      </span>
    </button>
  );
}

function AlbumCard({
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
  const photo = item.photos[0];
  const portrait = photo ? photo.height > photo.width : false;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开${item.title}，${item.count}张照片`}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-[8px] text-left",
        FOCUS_RING_CLASS_NAME,
      )}
    >
      <span className="relative block aspect-3/2 overflow-hidden rounded-[12px] border border-line bg-surface">
        <span aria-hidden="true" className="photo-sketch" style={photoBackgroundStyle(item.id)} />
        <PhotoPrint
          baseUrl={baseUrl}
          photo={photo}
          status={item.status}
          eager={eager}
          fallbackAspect="4 / 3"
          className={
            portrait
              ? "left-[36%] top-[12%] w-[28%] -rotate-3"
              : "left-[28%] top-[14%] w-[44%] -rotate-2"
          }
        />
      </span>
      <AlbumCaption title={item.title} meta={`${item.latestMonth} · ${item.count} 张`} />
    </button>
  );
}

function AllPhotosCard({
  count,
  range,
  onOpen,
}: {
  count: number;
  range: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`按时间浏览全部${count}张照片`}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-[8px] text-left",
        FOCUS_RING_CLASS_NAME,
      )}
    >
      <span className="relative block aspect-3/2 overflow-hidden rounded-[12px] border border-line bg-surface">
        <span aria-hidden="true" className="photo-sketch" style={photoBackgroundStyle(null)} />
        <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-line bg-paper/95 px-5 py-3.5">
          <span className="font-display text-[28px] leading-none text-ink-800">按时间浏览</span>
          <span className="font-mono text-[11px] text-ink-500">从最近的照片开始</span>
        </span>
      </span>
      <AlbumCaption title="全部照片" meta={`${range} · ${count} 张`} />
    </button>
  );
}

function AlbumCaption({ title, meta }: { title: string; meta: string }) {
  return (
    <span className="flex items-baseline justify-between gap-3 px-0.5">
      <span className="text-base font-medium text-ink-800 transition-colors group-hover:text-accent sm:text-[17px]">
        {title}
      </span>
      <span className="font-mono text-xs text-ink-500">{meta}</span>
    </span>
  );
}

function PhotoPrint({
  baseUrl,
  photo,
  status,
  eager,
  fallbackAspect,
  className,
}: {
  baseUrl: string;
  photo: PhotoRecord | undefined;
  status: AlbumOverviewItem["status"];
  eager: boolean;
  fallbackAspect: string;
  className: string;
}) {
  if (!photo && status === "ready") {
    return null;
  }
  return (
    <span
      className={cn(
        "absolute overflow-hidden border-4 border-white bg-ink-100 shadow-[0_1px_2px_rgba(20,21,26,0.08),0_14px_28px_-14px_rgba(20,21,26,0.5)] transition-transform duration-(--duration-fast) ease-(--ease-smooth-out) group-hover:-translate-y-0.5 sm:border-[6px] dark:border-ink-700",
        status === "loading" && "animate-pulse motion-reduce:animate-none",
        className,
      )}
      style={{ aspectRatio: photo ? `${photo.width} / ${photo.height}` : fallbackAspect }}
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
  );
}

function JourneyYears({
  years,
  onOpenAlbum,
}: {
  years: JourneyYear[];
  onOpenAlbum: (albumId: string) => void;
}) {
  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium text-ink-800 sm:text-xl">旅程年表</h2>
        <p className="text-[13px] text-ink-500">同一座城市去过多次，会出现在不同年份</p>
      </div>
      <dl className="mt-4 border-t border-line">
        {years.map(({ year, albums }, index) => (
          <div key={year} className="flex gap-4 border-b border-line py-3 sm:gap-6 sm:py-3.5">
            <dt
              className={cn(
                "w-11 shrink-0 font-mono text-xs leading-8 sm:w-18 sm:text-[13px]",
                index === 0 ? "text-accent" : "text-ink-500",
              )}
            >
              {year}
            </dt>
            <dd className="flex flex-wrap gap-x-4 sm:gap-x-5">
              {albums.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => onOpenAlbum(album.id)}
                  className={cn(
                    "min-h-8 rounded-[4px] text-sm text-ink-800 transition-colors hover:text-accent",
                    FOCUS_RING_CLASS_NAME,
                  )}
                >
                  {album.title} <span className="text-ink-500">{album.count}</span>
                </button>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
