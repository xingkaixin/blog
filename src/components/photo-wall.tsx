import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "@/assets/fonts/noto-serif.css";
import "@/components/photo-background.css";
import { PhotoLightbox, PhotoThumbnailRegistryProvider } from "@/components/photo-lightbox";
import { PhotoOverview, PhotoWallError, PhotoWallLoading } from "@/components/photo-overview";
import { PhotoTimeline } from "@/components/photo-timeline";
import { useActivePhotoMonth } from "@/hooks/use-active-photo-month";
import { usePhotoBrowsingSession } from "@/hooks/use-photo-browsing-session";
import { usePhotoCatalogSession } from "@/hooks/use-photo-catalog-session";
import { PhotoLocaleContext } from "@/hooks/use-photo-messages";
import type { Locale } from "@/lib/i18n";
import { englishAlbumTitle, photoMessages } from "@/lib/messages/photos";
import type { PhotoMonthCatalog, PhotoPeriod, PhotoRecord } from "@/lib/photo-catalog";
import {
  buildOverviewItems,
  buildPhotoWallCatalogModel,
  type AlbumOverviewItem,
  type PhotoTimelineModel,
  type PhotoYearActivity,
} from "@/lib/photo-wall-model";
import { getCssEasing, isDesktopViewport, prefersReducedMotion } from "@/lib/sliding-pill";

type PhotoWallProps = {
  baseUrl: string;
  locale: Locale;
};

type OverviewSnapshot = {
  mode: "overview";
  albumCount: number;
  allPhotoCount: number;
  items: AlbumOverviewItem[];
  yearActivity: PhotoYearActivity[];
  failedPeriods: PhotoPeriod[];
};

type TimelineSnapshot = {
  mode: "timeline";
  model: PhotoTimelineModel;
  monthCatalogs: Record<string, PhotoMonthCatalog>;
  monthErrors: Record<string, string>;
  activeMonth: string;
};

type ViewSnapshot = OverviewSnapshot | TimelineSnapshot;

type ViewCrossTransition = {
  id: number;
  leaving: ViewSnapshot;
  leavingScrollY: number;
};

const INITIAL_PERIOD_COUNT = 2;
const NOOP = () => {};
const NOOP_ALBUM = (_albumId: string | null) => {};
const NOOP_MONTH = (_month: string) => {};
const NOOP_PERIOD = (_period: PhotoPeriod) => {};
const NOOP_PHOTO = (_photo: PhotoRecord) => {};

export function PhotoWall({ baseUrl, locale }: PhotoWallProps) {
  const t = photoMessages[locale];
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const {
    state: catalogState,
    index: sourceIndex,
    months: monthCatalogs,
    monthErrors,
    reload: loadCatalog,
    requestMonth,
    retryMonth,
    resolvePhoto,
  } = usePhotoCatalogSession(normalizedBaseUrl);
  const index = useMemo(
    () =>
      sourceIndex && locale === "en"
        ? {
            ...sourceIndex,
            albums: sourceIndex.albums.map((album) => ({
              ...album,
              title: englishAlbumTitle(album.id),
            })),
          }
        : sourceIndex,
    [locale, sourceIndex],
  );
  const browsing = usePhotoBrowsingSession({
    index,
    months: monthCatalogs,
    monthErrors,
    requestMonth,
    retryMonth,
    resolvePhoto,
  });
  const photoView = browsing.view;
  const selectedAlbumId = photoView.mode === "timeline" ? photoView.albumId : null;
  const catalogModel = useMemo(
    () => buildPhotoWallCatalogModel(index, selectedAlbumId, locale),
    [index, locale, selectedAlbumId],
  );
  const overviewItems = useMemo(
    () =>
      photoView.mode === "overview"
        ? buildOverviewItems(catalogModel.overviewSummaries, monthCatalogs, monthErrors)
        : [],
    [catalogModel, monthCatalogs, monthErrors, photoView.mode],
  );

  useEffect(() => {
    for (const period of catalogModel.visiblePeriods.slice(0, INITIAL_PERIOD_COUNT)) {
      requestMonth(period);
    }
  }, [catalogModel.visiblePeriods, requestMonth]);

  useEffect(() => {
    if (photoView.mode !== "overview") {
      return;
    }
    for (const period of catalogModel.overviewPeriods) {
      requestMonth(period);
    }
  }, [catalogModel.overviewPeriods, requestMonth, photoView.mode]);

  const { activeMonth, wallRef, jumpToMonth } = useActivePhotoMonth(
    photoView.mode === "timeline",
    catalogModel.visiblePeriods,
    requestMonth,
  );
  const { selectionState: photoSelection, selectedPhoto, displayPhoto } = browsing;
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const handleOpenPhoto = useCallback(
    (photo: PhotoRecord, trigger?: HTMLElement | null) => {
      setTriggerElement(trigger ?? null);
      browsing.openPhoto(photo);
    },
    [browsing],
  );
  const handleRandomPhoto = useCallback(
    (trigger?: HTMLElement | null) => {
      setTriggerElement(trigger ?? null);
      browsing.openRandomPhoto();
    },
    [browsing],
  );
  const handleCloseComplete = useCallback(() => {
    setTriggerElement(null);
  }, []);

  const activeViewRef = useRef<HTMLDivElement>(null);
  const leavingViewRef = useRef<HTMLDivElement>(null);
  const leavingScrollOffsetRef = useRef<HTMLDivElement>(null);
  const leavingWallRef = useRef<HTMLDivElement>(null);
  const lastSettledModeRef = useRef<"overview" | "timeline" | null>(null);
  const settledEnterFromRef = useRef<"overview" | "timeline" | null>(null);
  const committedSnapshotRef = useRef<ViewSnapshot | null>(null);
  const transitionIdRef = useRef(0);
  const activeFadeRef = useRef<Animation | null>(null);
  const leavingFadeRef = useRef<Animation | null>(null);
  const [crossTransition, setCrossTransition] = useState<ViewCrossTransition | null>(null);

  const failedOverviewPeriods = useMemo(
    () => catalogModel.overviewPeriods.filter((period) => period.month in monthErrors),
    [catalogModel.overviewPeriods, monthErrors],
  );

  const currentSnapshot = useMemo<ViewSnapshot | null>(() => {
    if (catalogState.status !== "ready") {
      return null;
    }
    if (photoView.mode === "overview") {
      return {
        mode: "overview",
        albumCount: catalogModel.albumCount,
        allPhotoCount: catalogModel.allPhotoCount,
        items: overviewItems,
        yearActivity: catalogModel.yearActivity,
        failedPeriods: failedOverviewPeriods,
      };
    }
    return {
      mode: "timeline",
      model: catalogModel,
      monthCatalogs,
      monthErrors,
      activeMonth,
    };
  }, [
    activeMonth,
    catalogModel,
    catalogState.status,
    failedOverviewPeriods,
    monthCatalogs,
    monthErrors,
    overviewItems,
    photoView.mode,
  ]);

  const modeSwitched =
    catalogState.status === "ready" &&
    lastSettledModeRef.current !== null &&
    lastSettledModeRef.current !== photoView.mode;
  const enterFrom: "overview" | "timeline" | null = modeSwitched
    ? photoView.mode === "timeline" && selectedAlbumId !== null
      ? null
      : lastSettledModeRef.current
    : settledEnterFromRef.current;

  useLayoutEffect(() => {
    if (catalogState.status !== "ready" || !currentSnapshot) {
      return;
    }

    const prevMode = lastSettledModeRef.current;
    const prevSnapshot = committedSnapshotRef.current;
    lastSettledModeRef.current = photoView.mode;
    committedSnapshotRef.current = currentSnapshot;

    if (prevMode === null || prevMode === photoView.mode) {
      return;
    }

    settledEnterFromRef.current =
      photoView.mode === "timeline" && selectedAlbumId !== null ? null : prevMode;

    if (
      !prevSnapshot ||
      prefersReducedMotion() ||
      typeof activeViewRef.current?.animate !== "function"
    ) {
      setCrossTransition(null);
      return;
    }

    if (activeFadeRef.current) {
      activeFadeRef.current.cancel();
      activeFadeRef.current = null;
    }
    if (leavingFadeRef.current) {
      leavingFadeRef.current.cancel();
      leavingFadeRef.current = null;
    }

    const duration = isDesktopViewport() ? 180 : 240;
    const easing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");
    const enterAnim = activeViewRef.current.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
      easing,
    });
    activeFadeRef.current = enterAnim;
    void enterAnim.finished
      .catch(() => {})
      .finally(() => {
        if (activeFadeRef.current === enterAnim) {
          activeFadeRef.current = null;
        }
      });

    const nextId = transitionIdRef.current + 1;
    transitionIdRef.current = nextId;
    setCrossTransition({
      id: nextId,
      leaving: prevSnapshot,
      leavingScrollY: typeof window !== "undefined" ? window.scrollY : 0,
    });
  }, [catalogState.status, currentSnapshot, photoView.mode, selectedAlbumId]);

  useLayoutEffect(() => {
    if (!crossTransition) {
      return undefined;
    }
    const leavingEl = leavingViewRef.current;
    const offsetEl = leavingScrollOffsetRef.current;
    if (!leavingEl || !offsetEl || typeof leavingEl.animate !== "function") {
      setCrossTransition(null);
      return undefined;
    }

    const syncOffset = () => {
      const currentY = typeof window !== "undefined" ? window.scrollY : 0;
      offsetEl.style.transform = `translate3d(0, ${-(crossTransition.leavingScrollY - currentY)}px, 0)`;
    };
    syncOffset();

    const duration = isDesktopViewport() ? 180 : 240;
    const easing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");
    const leaveAnim = leavingEl.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration,
      easing,
    });
    leavingFadeRef.current = leaveAnim;
    window.addEventListener("scroll", syncOffset, { passive: true });
    let cancelled = false;

    void leaveAnim.finished
      .catch(() => {})
      .finally(() => {
        window.removeEventListener("scroll", syncOffset);
        if (leavingFadeRef.current === leaveAnim) {
          leavingFadeRef.current = null;
        }
        if (!cancelled) {
          setCrossTransition((current) => (current?.id === crossTransition.id ? null : current));
        }
      });

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", syncOffset);
      leaveAnim.cancel();
    };
  }, [crossTransition]);

  useEffect(() => {
    return () => {
      if (activeFadeRef.current) {
        activeFadeRef.current.cancel();
        activeFadeRef.current = null;
      }
      if (leavingFadeRef.current) {
        leavingFadeRef.current.cancel();
        leavingFadeRef.current = null;
      }
    };
  }, []);

  // 总览的月份柱跳到全部照片时间线；等时间线渲染出月份锚点后再滚动。
  const pendingMonthRef = useRef<string | null>(null);
  const openMonth = (month: string) => {
    pendingMonthRef.current = month;
    browsing.openTimeline(null);
  };
  useEffect(() => {
    const month = pendingMonthRef.current;
    if (photoView.mode === "timeline" && month) {
      pendingMonthRef.current = null;
      jumpToMonth(month);
    }
  }, [jumpToMonth, photoView.mode]);

  return (
    <PhotoLocaleContext value={locale}>
      <PhotoThumbnailRegistryProvider active>
        <section data-photo-darkroom className="relative min-h-[calc(100svh-160px)] pb-20">
          {catalogState.status === "loading" && <PhotoWallLoading />}
          {catalogState.status === "error" && (
            <PhotoWallError message={catalogState.message} onRetry={() => void loadCatalog()} />
          )}

          {catalogState.status === "ready" && (
            <div ref={activeViewRef}>
              {photoView.mode === "overview" && (
                <PhotoOverview
                  baseUrl={normalizedBaseUrl}
                  albumCount={catalogModel.albumCount}
                  photoCount={catalogModel.allPhotoCount}
                  items={overviewItems}
                  yearActivity={catalogModel.yearActivity}
                  failedPeriods={failedOverviewPeriods}
                  previousView={enterFrom}
                  onRetryMonth={retryMonth}
                  onOpenAlbum={browsing.openTimeline}
                  onOpenMonth={openMonth}
                  onRandomPhoto={handleRandomPhoto}
                />
              )}
              {photoView.mode === "timeline" && (
                <PhotoTimeline
                  baseUrl={normalizedBaseUrl}
                  model={catalogModel}
                  monthCatalogs={monthCatalogs}
                  monthErrors={monthErrors}
                  activeMonth={activeMonth}
                  wallRef={wallRef}
                  previousView={enterFrom}
                  onReturn={browsing.returnToOverview}
                  onSelectAlbum={browsing.selectAlbum}
                  onLoadMonth={requestMonth}
                  onRetryMonth={retryMonth}
                  onOpenPhoto={handleOpenPhoto}
                  onJumpMonth={jumpToMonth}
                />
              )}
            </div>
          )}

          {crossTransition && (
            <div
              ref={leavingViewRef}
              inert
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div ref={leavingScrollOffsetRef}>
                <PhotoThumbnailRegistryProvider active={false}>
                  {crossTransition.leaving.mode === "overview" ? (
                    <PhotoOverview
                      baseUrl={normalizedBaseUrl}
                      albumCount={crossTransition.leaving.albumCount}
                      photoCount={crossTransition.leaving.allPhotoCount}
                      items={crossTransition.leaving.items}
                      yearActivity={crossTransition.leaving.yearActivity}
                      failedPeriods={crossTransition.leaving.failedPeriods}
                      pillAnimationsEnabled={false}
                      onRetryMonth={NOOP_PERIOD}
                      onOpenAlbum={NOOP_ALBUM}
                      onOpenMonth={NOOP_MONTH}
                      onRandomPhoto={NOOP}
                    />
                  ) : (
                    <PhotoTimeline
                      baseUrl={normalizedBaseUrl}
                      model={crossTransition.leaving.model}
                      monthCatalogs={crossTransition.leaving.monthCatalogs}
                      monthErrors={crossTransition.leaving.monthErrors}
                      activeMonth={crossTransition.leaving.activeMonth}
                      wallRef={leavingWallRef}
                      showRail={false}
                      isLeaving
                      onReturn={NOOP}
                      onSelectAlbum={NOOP_ALBUM}
                      onLoadMonth={NOOP_PERIOD}
                      onRetryMonth={NOOP_PERIOD}
                      onOpenPhoto={NOOP_PHOTO}
                      onJumpMonth={NOOP_MONTH}
                    />
                  )}
                </PhotoThumbnailRegistryProvider>
              </div>
            </div>
          )}

          {photoSelection.status === "error" && (
            <div
              role="alert"
              className="fixed bottom-11 left-1/2 z-20 flex w-[min(420px,calc(100vw-1.5rem))] -translate-x-1/2 items-center justify-between gap-4 rounded-[8px] border border-line bg-surface px-4 py-3 shadow-lg"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-800">{t.photoOpenFailed}</p>
                <p className="mt-1 truncate text-xs text-ink-500">{photoSelection.message}</p>
              </div>
              <button
                type="button"
                onClick={browsing.retryPhoto}
                className="shrink-0 rounded-[6px] border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {t.retry}
              </button>
            </div>
          )}

          {displayPhoto && index && browsing.navigation && (
            <PhotoLightbox
              baseUrl={normalizedBaseUrl}
              open={selectedPhoto !== null}
              photo={displayPhoto}
              navigation={browsing.navigation}
              albums={index.albums}
              triggerElement={triggerElement}
              onClose={browsing.closePhoto}
              onCloseComplete={handleCloseComplete}
              onSelect={browsing.selectPhoto}
              onRetryNavigation={browsing.retryNavigation}
            />
          )}
        </section>
      </PhotoThumbnailRegistryProvider>
    </PhotoLocaleContext>
  );
}
