import type { CSSProperties, ReactNode } from "react";
import {
  PHOTO_THUMBNAIL_WIDTH,
  photoVariantUrl,
  type PhotoPeriod,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import type { AlbumOverviewItem, PhotoYearActivity } from "@/lib/photo-wall-model";
import { cn } from "@/lib/utils";

type PhotoOverviewProps = {
  baseUrl: string;
  albumCount: number;
  photoCount: number;
  photoRange: string;
  items: AlbumOverviewItem[];
  yearActivity: PhotoYearActivity[];
  failedPeriods: PhotoPeriod[];
  onRetryMonth: (period: PhotoPeriod) => void;
  onOpenAlbum: (albumId: string | null) => void;
  onOpenMonth: (month: string) => void;
};

const PAGE_CLASS_NAME = "mx-auto max-w-340 px-4 pt-8 sm:px-6 lg:px-10 lg:pt-16";
const FOCUS_RING_CLASS_NAME =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";
const ROLL_CARD_COUNT = 6;
const MAX_BAR_HEIGHT = 96;

export function PhotoOverview({
  baseUrl,
  albumCount,
  photoCount,
  photoRange,
  items,
  yearActivity,
  failedPeriods,
  onRetryMonth,
  onOpenAlbum,
  onOpenMonth,
}: PhotoOverviewProps) {
  const [featured, ...rest] = items;
  const rollCards = rest.slice(0, ROLL_CARD_COUNT);
  const rollLabels = rest.slice(ROLL_CARD_COUNT);
  const monthCount = yearActivity.reduce(
    (sum, year) => sum + year.months.filter((month) => month.count > 0).length,
    0,
  );

  return (
    <div className={PAGE_CLASS_NAME}>
      {failedPeriods.length > 0 && (
        <div
          role="alert"
          className="mb-8 flex items-center justify-between gap-4 rounded-[8px] border border-line bg-surface px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-ink-800">相册预览加载失败</p>
            <p className="mt-1 text-xs text-ink-500">请检查网络后重试。</p>
          </div>
          <button
            type="button"
            onClick={() => failedPeriods.forEach(onRetryMonth)}
            className={cn(
              "shrink-0 rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-medium text-ink-700",
              FOCUS_RING_CLASS_NAME,
            )}
          >
            重试预览
          </button>
        </div>
      )}

      <section className="grid items-end gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="flex flex-col gap-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            Roll 01—{String(albumCount).padStart(2, "0")} · {photoCount} frames
            {photoRange && ` · ${photoRange}`}
          </p>
          <h1 className="font-serif text-[88px] font-black leading-[0.95] tracking-tight text-ink-800 sm:text-[136px]">
            照片墙
          </h1>
          <p className="max-w-110 text-[17px] leading-[1.8] text-ink-600">
            走过的 {albumCount} 座城市，一共 {photoCount}{" "}
            张。每座城市是一卷胶卷：按城市翻，或者沿着时间倒着走。
          </p>
          <dl className="flex gap-10 border-t border-line pt-4">
            <OverviewStat value={albumCount} label="座城市" />
            <OverviewStat value={photoCount} label="张照片" />
            <OverviewStat value={monthCount} label="个有照片的月份" />
          </dl>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onOpenAlbum(null)}
              className={cn(
                "inline-flex min-h-12 items-center rounded-full bg-ink-800 px-6 text-[15px] font-medium text-paper transition-transform active:scale-[0.97]",
                FOCUS_RING_CLASS_NAME,
              )}
            >
              按时间浏览全部 →
            </button>
          </div>
        </div>
        {featured && (
          <FeaturedRoll baseUrl={baseUrl} item={featured} onOpen={() => onOpenAlbum(featured.id)} />
        )}
      </section>

      <div className="sticky top-[60px] z-10 -mx-4 mt-16 flex flex-wrap items-center justify-between gap-3 border-y border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:mt-24 lg:px-10">
        <ViewSwitch view="overview" onSwitchView={() => onOpenAlbum(null)} />
        <span className="font-mono text-xs tracking-[0.12em] text-ink-500">
          {albumCount} 卷 · 按最近一次到访
        </span>
      </div>

      {rollCards.length > 0 && (
        <section aria-labelledby="photo-rolls-title" className="mt-12">
          <h2 id="photo-rolls-title" className="font-serif text-[28px] font-semibold text-ink-800">
            城市胶卷
          </h2>
          <div className="mt-7 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rollCards.map((item, index) => (
              <RollCard
                key={item.id}
                baseUrl={baseUrl}
                item={item}
                eager={index < 3}
                onOpen={() => onOpenAlbum(item.id)}
              />
            ))}
          </div>
        </section>
      )}

      {rollLabels.length > 0 && (
        <section aria-labelledby="photo-roll-labels-title" className="mt-18">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2
              id="photo-roll-labels-title"
              className="font-serif text-[22px] font-semibold text-ink-800"
            >
              其余 {rollLabels.length} 卷
            </h2>
            <p className="font-mono text-xs tracking-[0.12em] text-ink-500">片盒标签 · 点击进入</p>
          </div>
          <ul className="mt-4 grid gap-x-8 border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {rollLabels.map((item) => (
              <li key={item.id} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => onOpenAlbum(item.id)}
                  aria-label={`打开${item.title}，${item.count}张照片`}
                  className={cn(
                    "group flex min-h-13 w-full items-baseline gap-3 py-3.5 text-left",
                    FOCUS_RING_CLASS_NAME,
                  )}
                >
                  <RollNumber roll={item.roll} className="w-6" />
                  <span className="text-base text-ink-800 transition-colors group-hover:text-accent">
                    {item.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex-1 border-b border-dotted border-ink-300"
                  />
                  <span className="font-mono text-xs text-ink-500">
                    {item.latestMonth} · {item.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {yearActivity.length > 0 && <YearActivity years={yearActivity} onOpenMonth={onOpenMonth} />}
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
          className="mt-12 block h-[260px] rounded-[6px] bg-ink-100 sm:h-[360px]"
        />
        <div className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index}>
              <span aria-hidden="true" className="block h-[200px] rounded-[6px] bg-ink-100" />
              <span aria-hidden="true" className="mt-3.5 block h-6 w-24 bg-ink-100" />
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
        className="mt-10 flex min-h-72 flex-col items-center justify-center gap-4 rounded-[8px] border border-line bg-surface px-6 text-center"
      >
        <div>
          <h2 className="text-lg font-medium text-ink-800">照片暂时无法加载</h2>
          <p className="mt-2 text-sm leading-7 text-ink-500">{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "rounded-full bg-ink-800 px-5 py-2 text-sm font-medium text-paper active:scale-[0.97]",
            FOCUS_RING_CLASS_NAME,
          )}
        >
          重新加载
        </button>
      </div>
    </div>
  );
}

export function PhotoArchiveHeader({
  title = "照片墙",
  detail,
  view,
  onSwitchView,
}: {
  title?: string;
  detail?: string;
  view?: "overview" | "timeline";
  onSwitchView?: () => void;
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] tracking-[0.18em] text-ink-500">
          {detail ?? "正在读取照片档案"}
        </p>
        <h1 className="mt-3 font-serif text-[56px] font-black leading-none tracking-tight text-ink-800 sm:text-[80px]">
          {title}
        </h1>
      </div>
      {view && <ViewSwitch view={view} onSwitchView={onSwitchView} />}
    </header>
  );
}

function ViewSwitch({
  view,
  onSwitchView,
}: {
  view: "overview" | "timeline";
  onSwitchView?: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="浏览方式"
      className="flex self-start rounded-full border border-line bg-surface p-1 sm:self-auto"
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
        "min-h-10 rounded-full px-4 text-sm text-ink-500 transition-colors hover:text-ink-800 aria-pressed:bg-ink-800 aria-pressed:text-paper",
        FOCUS_RING_CLASS_NAME,
      )}
    >
      {label}
    </button>
  );
}

function OverviewStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className="text-[40px] font-light leading-none text-ink-800">{value}</dd>
    </div>
  );
}

function RollNumber({ roll, className }: { roll: number; className?: string }) {
  return (
    <span className={cn("font-mono text-[11px] text-film", className)}>
      {String(roll).padStart(2, "0")}
    </span>
  );
}

function FeaturedRoll({
  baseUrl,
  item,
  onOpen,
}: {
  baseUrl: string;
  item: AlbumOverviewItem;
  onOpen: () => void;
}) {
  const frames = item.status === "ready" ? item.photos : Array.from({ length: 4 }, () => undefined);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开${item.title}，${item.count}张照片`}
      className={cn(
        "group flex w-full flex-col gap-5 rounded-[8px] text-left",
        FOCUS_RING_CLASS_NAME,
      )}
    >
      <span className="flex items-baseline justify-between font-mono text-[11px] tracking-[0.16em] text-ink-500">
        <span>最近一卷 · LATEST ROLL</span>
        <span className="text-accent">● {item.latestMonth}</span>
      </span>
      <FilmStrip className="gap-2.5 p-3 sm:px-3.5">
        <span className="flex h-[220px] gap-2 sm:h-[320px]">
          {frames.map((photo, index) => (
            <span
              key={photo?.id ?? index}
              className={cn("relative flex min-w-0 flex-col gap-2", index === 3 && "max-sm:hidden")}
              style={frameFlex(photo)}
            >
              <span aria-hidden="true" className="font-mono text-[10px] tracking-[0.1em] text-film">
                {index === 0 && "▸ "}
                {String(index + 1).padStart(2, "0")}
                {index % 2 === 1 && "A"}
              </span>
              <span className="relative min-h-0 flex-1">
                <FilmFrame
                  baseUrl={baseUrl}
                  photo={photo}
                  loading={item.status === "loading"}
                  eager
                />
                {index === 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -inset-x-2 -inset-y-2.5 -rotate-3 rounded-[48%_52%_46%_54%] border-[2.5px] border-accent"
                  />
                )}
              </span>
            </span>
          ))}
        </span>
      </FilmStrip>
      <span className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <span className="flex items-baseline gap-4">
          <span className="font-serif text-[48px] font-black leading-none text-ink-800 transition-colors group-hover:text-accent sm:text-[64px]">
            {item.title}
          </span>
          <span className="font-mono text-xs text-ink-500">
            ROLL {String(item.roll).padStart(2, "0")}
          </span>
        </span>
        <span className="font-mono text-[13px] text-ink-600">
          {item.latestMonth} · {item.count} 张 →
        </span>
      </span>
    </button>
  );
}

function RollCard({
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
  const frames = item.status === "ready" ? item.photos : Array.from({ length: 3 }, () => undefined);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开${item.title}，${item.count}张照片`}
      className={cn(
        "group flex w-full flex-col gap-3.5 rounded-[8px] text-left",
        FOCUS_RING_CLASS_NAME,
      )}
    >
      <FilmStrip className="gap-2 p-2.5 transition-transform duration-(--duration-fast) ease-(--ease-smooth-out) group-hover:-translate-y-0.5">
        <span className="flex h-[168px] gap-1.5">
          {frames.map((photo, index) => (
            <span key={photo?.id ?? index} className="min-w-0 flex-1">
              <FilmFrame
                baseUrl={baseUrl}
                photo={photo}
                loading={item.status === "loading"}
                eager={eager}
              />
            </span>
          ))}
        </span>
      </FilmStrip>
      <span className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-3">
          <RollNumber roll={item.roll} />
          <span className="font-serif text-[30px] font-black leading-none text-ink-800 transition-colors group-hover:text-accent">
            {item.title}
          </span>
        </span>
        <span className="font-mono text-xs text-ink-500">
          {item.latestMonth} · {item.count} 张
        </span>
      </span>
    </button>
  );
}

function FilmStrip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("flex flex-col rounded-[6px] bg-surface", className)}>
      <span aria-hidden="true" className="film-sprockets" />
      {children}
      <span aria-hidden="true" className="film-sprockets" />
    </span>
  );
}

function FilmFrame({
  baseUrl,
  photo,
  loading,
  eager,
}: {
  baseUrl: string;
  photo: PhotoRecord | undefined;
  loading: boolean;
  eager: boolean;
}) {
  if (!photo) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "block h-full w-full bg-ink-100",
          loading && "animate-pulse motion-reduce:animate-none",
        )}
      />
    );
  }
  return (
    <img
      src={photoVariantUrl(baseUrl, photo, PHOTO_THUMBNAIL_WIDTH)}
      alt=""
      width={photo.width}
      height={photo.height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      className="block h-full w-full object-cover"
      style={{ backgroundColor: photo.placeholderColor }}
    />
  );
}

function frameFlex(photo: PhotoRecord | undefined): CSSProperties {
  return { flex: `${photo ? photo.width / photo.height : 0.75} 1 0` };
}

function YearActivity({
  years,
  onOpenMonth,
}: {
  years: PhotoYearActivity[];
  onOpenMonth: (month: string) => void;
}) {
  const months = years.flatMap((year) => year.months);
  const peak = months.reduce((best, month) => (month.count > best.count ? month : best), months[0]);

  return (
    <section aria-labelledby="photo-activity-title" className="mt-22">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="photo-activity-title" className="font-serif text-[22px] font-semibold text-ink-800">
          冲洗记录 · 每月拍了多少
        </h2>
        <p className="font-mono text-xs text-ink-500">
          最多：{formatMonth(peak.month)} {peak.count} 张 · 点任意一格跳到那个月
        </p>
      </div>
      <div className="mt-7 overflow-x-auto pb-2">
        <div
          className="grid min-w-max gap-3"
          style={{ gridTemplateColumns: `repeat(${years.length}, minmax(96px, 1fr))` }}
        >
          {years.map((year) => (
            <div key={year.year} className="flex flex-col gap-2.5">
              <div className="flex h-24 items-end gap-[3px] border-b border-ink-300">
                {year.months.map((month) =>
                  month.count > 0 ? (
                    <button
                      key={month.month}
                      type="button"
                      onClick={() => onOpenMonth(month.month)}
                      aria-label={`${formatMonth(month.month)}，${month.count} 张，跳到这个月`}
                      title={`${formatMonth(month.month)} · ${month.count} 张`}
                      className={cn(
                        "flex-1 rounded-t-[1px] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        month.count * 2 >= peak.count ? "bg-accent" : "bg-ink-400",
                      )}
                      style={{
                        height: `${Math.min(MAX_BAR_HEIGHT, Math.round(Math.sqrt(month.count) * 10))}px`,
                      }}
                    />
                  ) : (
                    <span
                      key={month.month}
                      aria-hidden="true"
                      className="h-0.5 flex-1 bg-ink-200"
                    />
                  ),
                )}
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-ink-800">{year.year}</span>
                <span className="text-ink-500">{year.total > 0 ? `${year.total} 张` : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatMonth(month: string): string {
  return month.replace("-", ".");
}
