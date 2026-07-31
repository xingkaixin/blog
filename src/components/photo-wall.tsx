import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoPeriodSection } from "@/components/photo-period";
import { PhotoTimeRail } from "@/components/photo-time-rail";
import {
  catalogIndexUrl,
  monthFromCapturedAt,
  parsePhotoCatalogIndex,
  parsePhotoMonthCatalog,
  photoObjectUrl,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import { cn } from "@/lib/utils";

type PhotoWallProps = {
  baseUrl: string;
};

type CatalogState =
  | { status: "loading" }
  | { status: "ready"; index: PhotoCatalogIndex }
  | { status: "error" };

type MonthCatalogs = Record<string, PhotoMonthCatalog>;
type MonthErrors = Record<string, string>;

const INITIAL_PERIOD_COUNT = 2;
const PHOTO_ID_PATTERN = /^[a-f0-9]{32}$/;

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function historyStateWithPhoto(photoId: string): Record<string, unknown> {
  const current = typeof history.state === "object" && history.state !== null ? history.state : {};
  return { ...current, photoWall: true, photoId };
}

export function PhotoWall({ baseUrl }: PhotoWallProps) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const [catalogState, setCatalogState] = useState<CatalogState>({ status: "loading" });
  const [monthCatalogs, setMonthCatalogs] = useState<MonthCatalogs>({});
  const [monthErrors, setMonthErrors] = useState<MonthErrors>({});
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const lastLightboxPhotoRef = useRef<PhotoRecord | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const monthCatalogsRef = useRef<MonthCatalogs>({});
  const monthPromisesRef = useRef(new Map<string, Promise<PhotoMonthCatalog>>());
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const activeMonthLockedUntilRef = useRef(0);

  const loadCatalog = useCallback(async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = requestGenerationRef.current + 1;
    requestControllerRef.current = controller;
    requestGenerationRef.current = generation;
    monthPromisesRef.current.clear();
    monthCatalogsRef.current = {};
    setMonthCatalogs({});
    setMonthErrors({});
    setSelectedPhoto(null);
    setCatalogState({ status: "loading" });

    try {
      if (!normalizedBaseUrl) {
        throw new Error("照片存储地址尚未配置");
      }
      const response = await fetch(catalogIndexUrl(normalizedBaseUrl), {
        cache: "no-cache",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`照片 Catalog 请求失败 (${response.status})`);
      }
      const index = parsePhotoCatalogIndex(await response.json());
      if (requestGenerationRef.current === generation) {
        setCatalogState({ status: "ready", index });
      }
    } catch (error) {
      if (controller.signal.aborted || requestGenerationRef.current !== generation) {
        return;
      }
      console.error("加载照片 Catalog 失败", error);
      setCatalogState({ status: "error" });
    }
  }, [normalizedBaseUrl]);

  useEffect(() => {
    void loadCatalog();
    return () => requestControllerRef.current?.abort();
  }, [loadCatalog]);

  const loadMonth = useCallback(
    (period: PhotoPeriod): Promise<PhotoMonthCatalog> => {
      const loaded = monthCatalogsRef.current[period.month];
      if (loaded) {
        return Promise.resolve(loaded);
      }
      const pending = monthPromisesRef.current.get(period.month);
      if (pending) {
        return pending;
      }

      const generation = requestGenerationRef.current;
      const request = (async () => {
        try {
          const response = await fetch(photoObjectUrl(normalizedBaseUrl, period.path), {
            cache: "force-cache",
            signal: requestControllerRef.current?.signal,
          });
          if (!response.ok) {
            throw new Error(`月份 ${period.month} 请求失败 (${response.status})`);
          }
          const monthCatalog = parsePhotoMonthCatalog(await response.json());
          if (monthCatalog.month !== period.month || monthCatalog.photos.length !== period.count) {
            throw new Error(`月份 ${period.month} 与主 Catalog 不一致`);
          }
          if (requestGenerationRef.current !== generation) {
            return monthCatalog;
          }

          setMonthCatalogs((current) => {
            const next = { ...current, [period.month]: monthCatalog };
            monthCatalogsRef.current = next;
            return next;
          });
          setMonthErrors((current) => {
            if (!(period.month in current)) {
              return current;
            }
            const next = { ...current };
            delete next[period.month];
            return next;
          });
          return monthCatalog;
        } catch (error) {
          monthPromisesRef.current.delete(period.month);
          if (
            requestGenerationRef.current === generation &&
            !requestControllerRef.current?.signal.aborted
          ) {
            console.error(`加载照片月份 ${period.month} 失败`, error);
            setMonthErrors((current) => ({
              ...current,
              [period.month]: readableError(error),
            }));
          }
          throw error;
        }
      })();

      monthPromisesRef.current.set(period.month, request);
      return request;
    },
    [normalizedBaseUrl],
  );

  const index = catalogState.status === "ready" ? catalogState.index : null;

  useEffect(() => {
    if (!index) {
      return;
    }
    const requestedAlbum = new URL(window.location.href).searchParams.get("album");
    const albumExists = index.albums.some((album) => album.id === requestedAlbum);
    setSelectedAlbumId((current) => {
      if (current && index.albums.some((album) => album.id === current)) {
        return current;
      }
      return requestedAlbum && albumExists ? requestedAlbum : null;
    });
  }, [index]);

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
    const wall = wallRef.current;
    if (!wall || visiblePeriods.length === 0) {
      return undefined;
    }

    const visibleEntries = new Map<Element, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleEntries.set(entry.target, entry);
          } else {
            visibleEntries.delete(entry.target);
          }
        }
        if (Date.now() < activeMonthLockedUntilRef.current) {
          return;
        }
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
      },
      {
        rootMargin: "-90px 0px -68% 0px",
        threshold: 0,
      },
    );

    for (const section of wall.querySelectorAll("[data-photo-month]")) {
      observer.observe(section);
    }
    return () => observer.disconnect();
  }, [visiblePeriods]);

  const allLoadedPhotos = useMemo(
    () => index?.periods.flatMap((period) => monthCatalogs[period.month]?.photos ?? []) ?? [],
    [index, monthCatalogs],
  );
  const filteredLoadedPhotos = useMemo(
    () =>
      allLoadedPhotos.filter(
        (photo) => !selectedAlbumId || photo.albumIds.includes(selectedAlbumId),
      ),
    [allLoadedPhotos, selectedAlbumId],
  );
  useEffect(() => {
    if (selectedPhoto) {
      lastLightboxPhotoRef.current = selectedPhoto;
    }
  }, [selectedPhoto]);
  // 关闭后继续渲染最后一张，退出淡出期间大图内容不能先消失
  const lightboxDisplayPhoto = selectedPhoto ?? lastLightboxPhotoRef.current;

  const lightboxPhotos =
    lightboxDisplayPhoto &&
    filteredLoadedPhotos.some((photo) => photo.id === lightboxDisplayPhoto.id)
      ? filteredLoadedPhotos
      : allLoadedPhotos;

  const preloadAdjacentPeriods = useCallback(
    (photo: PhotoRecord) => {
      if (!index) {
        return;
      }
      const currentIndex = index.periods.findIndex(
        (period) => period.month === monthFromCapturedAt(photo.capturedAt),
      );
      for (const adjacentIndex of [currentIndex - 1, currentIndex + 1]) {
        const period = index.periods[adjacentIndex];
        if (period) {
          void loadMonth(period).catch(() => undefined);
        }
      }
    },
    [index, loadMonth],
  );

  const openPhoto = useCallback(
    (photo: PhotoRecord) => {
      // 关闭时 history.back() 会对当前 entry 执行浏览器滚动恢复（叠加全局
      // scroll-behavior: smooth 表现为滚回顶部），先标记 manual 阻止它
      history.scrollRestoration = "manual";
      const url = new URL(window.location.href);
      url.searchParams.set("photo", photo.id);
      history.pushState(historyStateWithPhoto(photo.id), "", url);
      setSelectedPhoto(photo);
      preloadAdjacentPeriods(photo);
    },
    [preloadAdjacentPeriods],
  );

  const selectLightboxPhoto = useCallback(
    (photo: PhotoRecord) => {
      const url = new URL(window.location.href);
      url.searchParams.set("photo", photo.id);
      history.replaceState(historyStateWithPhoto(photo.id), "", url);
      setSelectedPhoto(photo);
      preloadAdjacentPeriods(photo);
    },
    [preloadAdjacentPeriods],
  );

  const closeLightbox = useCallback(() => {
    // 先本地关闭让退出动画立即起播，history 清理异步跟上（popstate 的同步是幂等的）
    setSelectedPhoto(null);
    if (
      typeof history.state === "object" &&
      history.state !== null &&
      history.state.photoWall === true
    ) {
      history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("photo");
    history.replaceState(history.state, "", url);
  }, []);

  useEffect(() => {
    if (!index) {
      return undefined;
    }
    let requestId = 0;
    let disposed = false;

    const syncPhotoFromUrl = async () => {
      const currentRequestId = ++requestId;
      const photoId = new URL(window.location.href).searchParams.get("photo");
      if (!photoId || !PHOTO_ID_PATTERN.test(photoId)) {
        // 回退已经提交、大图关闭，恢复 auto 让正常的跨页返回仍能还原滚动位置
        history.scrollRestoration = "auto";
        setSelectedPhoto(null);
        return;
      }

      let photo = Object.values(monthCatalogsRef.current)
        .flatMap((month) => month.photos)
        .find((candidate) => candidate.id === photoId);

      for (const period of index.periods) {
        if (photo) {
          break;
        }
        try {
          const month = await loadMonth(period);
          photo = month.photos.find((candidate) => candidate.id === photoId);
        } catch {
          continue;
        }
      }

      const currentPhotoId = new URL(window.location.href).searchParams.get("photo");
      if (!disposed && currentRequestId === requestId && currentPhotoId === photoId) {
        setSelectedPhoto(photo ?? null);
        if (photo) {
          preloadAdjacentPeriods(photo);
        }
      }
    };

    const handlePopState = () => {
      void syncPhotoFromUrl();
    };
    void syncPhotoFromUrl();
    window.addEventListener("popstate", handlePopState);
    return () => {
      disposed = true;
      requestId += 1;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [index, loadMonth, preloadAdjacentPeriods]);

  const selectAlbum = (albumId: string | null) => {
    setSelectedAlbumId(albumId);
    const url = new URL(window.location.href);
    if (albumId) {
      url.searchParams.set("album", albumId);
    } else {
      url.searchParams.delete("album");
    }
    history.replaceState(history.state, "", url);
  };

  const retryMonth = useCallback(
    (period: PhotoPeriod) => {
      monthPromisesRef.current.delete(period.month);
      setMonthErrors((current) => {
        const next = { ...current };
        delete next[period.month];
        return next;
      });
      void loadMonth(period).catch(() => undefined);
    },
    [loadMonth],
  );

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
      activeMonthLockedUntilRef.current = Date.now() + 1_000;
      setActiveMonth(month);
      document.getElementById(`photo-month-${month}`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    },
    [loadMonth, visiblePeriods],
  );

  const totalPhotoCount = visiblePeriods.reduce(
    (sum, period) =>
      sum + (selectedAlbumId ? (period.albumCounts[selectedAlbumId] ?? 0) : period.count),
    0,
  );

  return (
    <section className="pb-20 pt-9 sm:pt-12">
      <div className="mx-auto max-w-350 px-4 sm:px-6 lg:px-10">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <h1 className="font-display text-4xl text-ink-800 sm:text-5xl">照片墙</h1>
            {catalogState.status === "ready" && (
              <span className="pb-1 font-mono text-xs text-ink-400">{totalPhotoCount} 张照片</span>
            )}
          </div>
          <p className="mt-3 text-sm leading-7 text-ink-500">按拍摄时间，从最近的照片开始。</p>
        </div>

        {index && index.albums.length > 0 && (
          <div
            role="group"
            aria-label="筛选相册"
            className="-mx-4 mt-7 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              aria-pressed={selectedAlbumId === null}
              onClick={() => selectAlbum(null)}
              className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-600 transition-[transform,background-color,color,border-color] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]"
            >
              全部
            </button>
            {index.albums.map((album) => (
              <button
                key={album.id}
                type="button"
                aria-pressed={selectedAlbumId === album.id}
                onClick={() => selectAlbum(album.id)}
                className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-600 transition-[transform,background-color,color,border-color] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]"
              >
                {album.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        ref={wallRef}
        className={cn(
          "mx-auto mt-9 max-w-350",
          visiblePeriods.length > 1
            ? "pr-8 sm:px-6 sm:pr-14 lg:px-10 lg:pr-16"
            : "pr-0 sm:px-6 lg:px-10",
        )}
      >
        {catalogState.status === "loading" && <PhotoWallLoading />}
        {catalogState.status === "error" && (
          <div
            role="alert"
            className="flex min-h-72 flex-col items-center justify-center gap-4 border border-line bg-surface px-6 text-center"
          >
            <div>
              <h2 className="text-lg font-medium text-ink-800">照片暂时无法加载</h2>
              <p className="mt-2 text-sm leading-7 text-ink-500">请稍后重试。</p>
            </div>
            <button
              type="button"
              onClick={() => void loadCatalog()}
              className="rounded-full bg-ink-800 px-5 py-2.5 text-sm font-medium text-paper transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.97]"
            >
              重新加载
            </button>
          </div>
        )}
        {catalogState.status === "ready" && visiblePeriods.length === 0 && (
          <div className="flex min-h-72 items-center justify-center border border-line bg-surface px-6 text-center">
            <div>
              <h2 className="text-lg font-medium text-ink-800">
                {selectedAlbumId ? "这个相册还没有照片" : "还没有照片"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-ink-500">
                新照片发布后会按拍摄时间显示在这里。
              </p>
            </div>
          </div>
        )}
        {catalogState.status === "ready" && visiblePeriods.length > 0 && (
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

      {catalogState.status === "ready" && visiblePeriods.length > 1 && (
        <PhotoTimeRail
          periods={visiblePeriods}
          activeMonth={activeMonth}
          onSelect={(month) => void jumpToMonth(month)}
        />
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

function PhotoWallLoading() {
  return (
    <div aria-label="正在加载照片墙" className="space-y-9">
      {[
        { month: "最近", count: 8 },
        { month: "更早", count: 6 },
      ].map((group) => (
        <section key={group.month}>
          <div className="mb-3 flex items-center justify-between px-3 sm:px-0">
            <span className="h-3 w-24 bg-ink-100" />
            <span className="h-3 w-10 bg-ink-50" />
          </div>
          <div className="grid grid-cols-3 gap-0.5 md:grid-cols-4 md:gap-1">
            {Array.from({ length: group.count }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="aspect-square bg-ink-100 even:bg-ink-50"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
