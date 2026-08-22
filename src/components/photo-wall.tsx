import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoPeriodSection } from "@/components/photo-period";
import { PhotoTimeRail } from "@/components/photo-time-rail";
import { usePhotoCatalogSession } from "@/hooks/use-photo-catalog-session";
import { usePhotoLocation } from "@/hooks/use-photo-location";
import { usePhotoSelection } from "@/hooks/use-photo-selection";
import {
  planOverviewOpen,
  planPhotoClose,
  planPhotoOpen,
  planPhotoSelection,
  planTimelineOpen,
  planTimelineSelection,
} from "@/lib/photo-browser";
import {
  monthFromCapturedAt,
  photoVariantUrl,
  type PhotoPeriod,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import { cn } from "@/lib/utils";

type PhotoWallProps = {
  baseUrl: string;
};

type AlbumOverviewItem = {
  id: string | null;
  title: string;
  count: number;
  meta: string;
  photos: PhotoRecord[];
};

const INITIAL_PERIOD_COUNT = 2;
const ALBUM_CHIP_CLASS_NAME =
  "shrink-0 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800 aria-pressed:border-ink-800 aria-pressed:bg-ink-800 aria-pressed:text-paper";
const ALBUM_SIDEBAR_CLASS_NAME =
  "flex w-full items-center justify-between gap-3 rounded-[6px] px-2 py-1.5 text-left text-[13px] text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800 aria-pressed:bg-ink-100 aria-pressed:font-medium aria-pressed:text-ink-800 [&>span:last-child]:font-mono [&>span:last-child]:text-[9px] [&>span:last-child]:text-ink-400";

function formatPeriodRange(periods: PhotoPeriod[]): string {
  const newest = periods[0]?.month;
  const oldest = periods.at(-1)?.month;
  if (!newest || !oldest) {
    return "";
  }
  if (newest === oldest) {
    const [year, month] = newest.split("-");
    return `${year}年${Number(month)}月`;
  }
  const newestYear = newest.slice(0, 4);
  const oldestYear = oldest.slice(0, 4);
  return newestYear === oldestYear ? newestYear : `${oldestYear} – ${newestYear}`;
}

export function PhotoWall({ baseUrl }: PhotoWallProps) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const {
    state: catalogState,
    index,
    months: monthCatalogs,
    monthErrors,
    reload: loadCatalog,
    loadMonth,
    retryMonth,
    resolvePhoto,
  } = usePhotoCatalogSession(normalizedBaseUrl);
  const { location: photoLocation, navigate } = usePhotoLocation(index);
  const photoView = photoLocation?.view ?? ({ mode: "overview" } as const);
  const locationPhotoId = photoLocation?.photoId;
  const [activeMonth, setActiveMonth] = useState("");
  const wallRef = useRef<HTMLDivElement>(null);
  const activeMonthLockRef = useRef<string | null>(null);

  const selectedAlbumId = photoView.mode === "timeline" ? photoView.albumId : null;

  const visiblePeriods = useMemo(() => {
    if (!index) {
      return [];
    }
    return index.periods.filter(
      (period) => !selectedAlbumId || (period.albumCounts[selectedAlbumId] ?? 0) > 0,
    );
  }, [index, selectedAlbumId]);

  useEffect(() => {
    for (const period of visiblePeriods.slice(0, INITIAL_PERIOD_COUNT)) {
      void loadMonth(period).catch(() => undefined);
    }
  }, [loadMonth, visiblePeriods]);

  useEffect(() => {
    if (visiblePeriods.length === 0) {
      setActiveMonth("");
      return;
    }
    setActiveMonth((current) =>
      visiblePeriods.some((period) => period.month === current) ? current : visiblePeriods[0].month,
    );
  }, [visiblePeriods]);

  useEffect(() => {
    if (photoView.mode !== "timeline") {
      return undefined;
    }
    const wall = wallRef.current;
    if (!wall || visiblePeriods.length === 0) {
      return undefined;
    }

    const visibleEntries = new Map<Element, IntersectionObserverEntry>();
    const selectVisibleMonth = () => {
      if (window.scrollY <= 1) {
        setActiveMonth(visiblePeriods[0].month);
        return;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1) {
        setActiveMonth(visiblePeriods[visiblePeriods.length - 1].month);
        return;
      }
      const nearest = [...visibleEntries.values()].toSorted(
        (left, right) =>
          Math.abs(left.boundingClientRect.top - 112) -
          Math.abs(right.boundingClientRect.top - 112),
      )[0];
      const month = nearest?.target.getAttribute("data-photo-month");
      if (month) {
        setActiveMonth((current) => (current === month ? current : month));
      }
    };
    const releaseActiveMonthLock = () => {
      if (activeMonthLockRef.current === null) {
        return;
      }
      activeMonthLockRef.current = null;
      selectVisibleMonth();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleEntries.set(entry.target, entry);
          } else {
            visibleEntries.delete(entry.target);
          }
        }
        const lockedMonth = activeMonthLockRef.current;
        if (lockedMonth !== null) {
          const targetIsVisible = [...visibleEntries.keys()].some(
            (entry) => entry.getAttribute("data-photo-month") === lockedMonth,
          );
          if (!targetIsVisible) {
            return;
          }
          activeMonthLockRef.current = null;
          setActiveMonth(lockedMonth);
          return;
        }
        selectVisibleMonth();
      },
      {
        rootMargin: "-90px 0px -68% 0px",
        threshold: 0,
      },
    );

    for (const section of wall.querySelectorAll("[data-photo-month]")) {
      observer.observe(section);
    }
    window.addEventListener("scrollend", releaseActiveMonthLock);
    return () => {
      activeMonthLockRef.current = null;
      observer.disconnect();
      window.removeEventListener("scrollend", releaseActiveMonthLock);
    };
  }, [photoView.mode, visiblePeriods]);

  const allLoadedPhotos = useMemo(
    () => index?.periods.flatMap((period) => monthCatalogs[period.month]?.photos ?? []) ?? [],
    [index, monthCatalogs],
  );
  const overviewPeriods = useMemo(() => {
    if (!index) {
      return [];
    }
    const neededMonths = new Set(index.periods.slice(0, 1).map((period) => period.month));
    for (const album of index.albums) {
      let previewCount = 0;
      for (const period of index.periods) {
        const count = period.albumCounts[album.id] ?? 0;
        if (count === 0) {
          continue;
        }
        neededMonths.add(period.month);
        previewCount += count;
        if (previewCount >= 4) {
          break;
        }
      }
    }
    return index.periods.filter((period) => neededMonths.has(period.month));
  }, [index]);

  useEffect(() => {
    if (photoView.mode !== "overview") {
      return;
    }
    for (const period of overviewPeriods) {
      void loadMonth(period).catch(() => undefined);
    }
  }, [loadMonth, overviewPeriods, photoView.mode]);

  const overviewItems = useMemo<AlbumOverviewItem[]>(() => {
    if (!index) {
      return [];
    }
    const totalCount = index.periods.reduce((sum, period) => sum + period.count, 0);
    const albumItems = index.albums.map((album) => {
      const albumPeriods = index.periods.filter(
        (period) => (period.albumCounts[album.id] ?? 0) > 0,
      );
      return {
        id: album.id,
        title: album.title,
        count: albumPeriods.reduce((sum, period) => sum + (period.albumCounts[album.id] ?? 0), 0),
        meta: formatPeriodRange(albumPeriods),
        photos: allLoadedPhotos.filter((photo) => photo.albumIds.includes(album.id)).slice(0, 4),
      };
    });
    return [
      {
        id: null,
        title: "全部",
        count: totalCount,
        meta: formatPeriodRange(index.periods),
        photos: allLoadedPhotos.slice(0, 4),
      },
      ...albumItems,
    ];
  }, [allLoadedPhotos, index]);
  const filteredLoadedPhotos = useMemo(
    () =>
      allLoadedPhotos.filter(
        (photo) => !selectedAlbumId || photo.albumIds.includes(selectedAlbumId),
      ),
    [allLoadedPhotos, selectedAlbumId],
  );
  const preloadAdjacentPeriods = useCallback(
    (photo: PhotoRecord) => {
      if (!index) {
        return;
      }
      const currentMonth = monthFromCapturedAt(photo.capturedAt);
      const filteredIndex = visiblePeriods.findIndex((period) => period.month === currentMonth);
      const periods = filteredIndex >= 0 ? visiblePeriods : index.periods;
      const currentIndex = periods.findIndex((period) => period.month === currentMonth);
      for (const adjacentIndex of [currentIndex - 1, currentIndex + 1]) {
        const period = periods[adjacentIndex];
        if (period) {
          void loadMonth(period).catch(() => undefined);
        }
      }
    },
    [index, loadMonth, visiblePeriods],
  );

  const closeMissingPhoto = useCallback(() => {
    navigate(planPhotoClose(window.location.href, history.state));
  }, [navigate]);
  const {
    state: photoSelection,
    selectedPhoto,
    displayPhoto: lightboxDisplayPhoto,
    select: selectPhoto,
    dismiss: dismissPhoto,
    retry: retryPhotoSelection,
  } = usePhotoSelection({
    catalogReady: index !== null,
    photoId: locationPhotoId,
    resolvePhoto,
    onMissing: closeMissingPhoto,
    onResolved: preloadAdjacentPeriods,
  });
  const lightboxPhotos =
    lightboxDisplayPhoto &&
    filteredLoadedPhotos.some((photo) => photo.id === lightboxDisplayPhoto.id)
      ? filteredLoadedPhotos
      : allLoadedPhotos;

  const openPhoto = useCallback(
    (photo: PhotoRecord) => {
      navigate(planPhotoOpen(window.location.href, history.state, photo.id));
      selectPhoto(photo);
    },
    [navigate, selectPhoto],
  );

  const selectLightboxPhoto = useCallback(
    (photo: PhotoRecord) => {
      navigate(planPhotoSelection(window.location.href, history.state, photo.id));
      selectPhoto(photo);
    },
    [navigate, selectPhoto],
  );

  const closeLightbox = useCallback(() => {
    // 先本地关闭让退出动画立即起播，history 清理异步跟上（popstate 的同步是幂等的）
    dismissPhoto();
    navigate(planPhotoClose(window.location.href, history.state));
  }, [dismissPhoto, navigate]);

  const openTimeline = (albumId: string | null) => {
    navigate(planTimelineOpen(window.location.href, history.state, albumId));
    window.scrollTo(0, 0);
  };

  const selectAlbum = (albumId: string | null) => {
    navigate(planTimelineSelection(window.location.href, history.state, albumId));
    window.scrollTo(0, 0);
  };

  const returnToOverview = () => {
    dismissPhoto();
    navigate(planOverviewOpen(window.location.href, history.state));
    window.scrollTo(0, 0);
  };

  const jumpToMonth = useCallback(
    async (month: string) => {
      const period = visiblePeriods.find((candidate) => candidate.month === month);
      if (!period) {
        return;
      }
      try {
        await loadMonth(period);
      } catch {
        // 月份内的错误状态仍然是一个有效的跳转目标。
      }
      const target = document.getElementById(`photo-month-${month}`);
      setActiveMonth(month);
      activeMonthLockRef.current = activeMonth === month ? null : month;
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    },
    [activeMonth, loadMonth, visiblePeriods],
  );

  const totalPhotoCount = visiblePeriods.reduce(
    (sum, period) =>
      sum + (selectedAlbumId ? (period.albumCounts[selectedAlbumId] ?? 0) : period.count),
    0,
  );
  const selectedAlbum = index?.albums.find((album) => album.id === selectedAlbumId);
  const timelineRange = formatPeriodRange(visiblePeriods);

  return (
    <section className="pb-20">
      {catalogState.status === "loading" && (
        <div className="mx-auto max-w-320 px-3 pt-8 sm:px-5 lg:px-8 lg:pt-[30px]">
          <PhotoArchiveHeader />
          <AlbumOverviewLoading />
        </div>
      )}

      {catalogState.status === "error" && (
        <div className="mx-auto max-w-320 px-3 pt-8 sm:px-5 lg:px-8 lg:pt-[30px]">
          <PhotoArchiveHeader />
          <div
            role="alert"
            className="mt-8 flex min-h-72 flex-col items-center justify-center gap-4 rounded-[10px] border border-line bg-surface px-6 text-center"
          >
            <div>
              <h2 className="text-lg font-medium text-ink-800">照片暂时无法加载</h2>
              <p className="mt-2 text-sm leading-7 text-ink-500">{catalogState.message}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadCatalog()}
              className="rounded-[6px] bg-ink-800 px-4 py-2 text-sm font-medium text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.97]"
            >
              重新加载
            </button>
          </div>
        </div>
      )}

      {catalogState.status === "ready" && photoView.mode === "overview" && (
        <div className="mx-auto max-w-320 px-3 pt-8 sm:px-5 lg:px-8 lg:pt-[30px]">
          <PhotoArchiveHeader
            detail={`${catalogState.index.albums.length} 个相册 · ${overviewItems[0]?.count ?? 0} 张照片`}
          />
          <div className="mt-[26px] grid gap-[26px] sm:grid-cols-2 lg:grid-cols-3">
            {overviewItems.map((item, itemIndex) => (
              <AlbumOverviewCard
                key={item.id ?? "all"}
                baseUrl={normalizedBaseUrl}
                item={item}
                eager={itemIndex < 3}
                onOpen={() => openTimeline(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {catalogState.status === "ready" && photoView.mode === "timeline" && (
        <div className="mx-auto max-w-320">
          <header className="flex flex-wrap items-center gap-2.5 border-b border-line px-3 py-3 sm:px-6">
            <button
              type="button"
              onClick={returnToOverview}
              className="inline-flex items-center gap-1.5 rounded-[5px] text-[13px] text-ink-500 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <ArrowLeftIcon aria-hidden="true" className="h-3.5 w-3.5" />
              相册
            </button>
            <span aria-hidden="true" className="text-line">
              /
            </span>
            <h1 className="text-[15px] font-medium text-ink-800">
              {selectedAlbum?.title ?? "全部"}
            </h1>
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
              onClick={() => selectAlbum(null)}
              className={ALBUM_CHIP_CLASS_NAME}
            >
              全部
            </button>
            {catalogState.index.albums.map((album) => (
              <button
                key={album.id}
                type="button"
                aria-pressed={selectedAlbumId === album.id}
                onClick={() => selectAlbum(album.id)}
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
                  onClick={() => selectAlbum(null)}
                  className={ALBUM_SIDEBAR_CLASS_NAME}
                >
                  <span>全部照片</span>
                  <span>
                    {catalogState.index.periods.reduce((sum, period) => sum + period.count, 0)}
                  </span>
                </button>
                {catalogState.index.albums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    aria-pressed={selectedAlbumId === album.id}
                    onClick={() => selectAlbum(album.id)}
                    className={ALBUM_SIDEBAR_CLASS_NAME}
                  >
                    <span>{album.title}</span>
                    <span>
                      {catalogState.index.periods.reduce(
                        (sum, period) => sum + (period.albumCounts[album.id] ?? 0),
                        0,
                      )}
                    </span>
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
                      baseUrl={normalizedBaseUrl}
                      period={period}
                      monthCatalog={monthCatalogs[period.month]}
                      albumId={selectedAlbumId}
                      error={monthErrors[period.month]}
                      eager={indexInList === 0}
                      onVisible={() => {
                        void loadMonth(period).catch(() => undefined);
                      }}
                      onRetry={() => retryMonth(period)}
                      onOpenPhoto={openPhoto}
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
      )}

      {catalogState.status === "ready" &&
        photoView.mode === "timeline" &&
        visiblePeriods.length > 1 && (
          <PhotoTimeRail
            periods={visiblePeriods}
            activeMonth={activeMonth}
            onSelect={(month) => void jumpToMonth(month)}
          />
        )}

      {photoSelection.status === "error" && (
        <div
          role="alert"
          className="fixed bottom-11 left-1/2 z-20 flex w-[min(420px,calc(100vw-1.5rem))] -translate-x-1/2 items-center justify-between gap-4 rounded-[8px] border border-line bg-surface px-4 py-3 shadow-lg"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-800">照片暂时无法打开</p>
            <p className="mt-1 truncate text-xs text-ink-500">{photoSelection.message}</p>
          </div>
          <button
            type="button"
            onClick={retryPhotoSelection}
            className="shrink-0 rounded-[6px] border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            重试
          </button>
        </div>
      )}

      {lightboxDisplayPhoto && index && (
        <PhotoLightbox
          baseUrl={normalizedBaseUrl}
          open={selectedPhoto !== null}
          photo={lightboxDisplayPhoto}
          photos={lightboxPhotos}
          albums={index.albums}
          onClose={closeLightbox}
          onSelect={selectLightboxPhoto}
        />
      )}
    </section>
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
                src={photoVariantUrl(baseUrl, photo.id, 480)}
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

function AlbumOverviewLoading() {
  return (
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
  );
}
