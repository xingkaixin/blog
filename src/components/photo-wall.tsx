import { useCallback, useEffect, useMemo } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoOverview, PhotoWallError, PhotoWallLoading } from "@/components/photo-overview";
import { PhotoTimeline } from "@/components/photo-timeline";
import { useActivePhotoMonth } from "@/hooks/use-active-photo-month";
import { usePhotoCatalogSession } from "@/hooks/use-photo-catalog-session";
import { usePhotoLocation } from "@/hooks/use-photo-location";
import { usePhotoSelection } from "@/hooks/use-photo-selection";
import { monthFromCapturedAt, type PhotoRecord } from "@/lib/photo-catalog";
import {
  planOverviewOpen,
  planPhotoClose,
  planPhotoOpen,
  planPhotoSelection,
  planTimelineOpen,
  planTimelineSelection,
} from "@/lib/photo-location";
import { buildPhotoWallLoadedModel, buildPhotoWallPeriodModel } from "@/lib/photo-wall-model";

type PhotoWallProps = {
  baseUrl: string;
};

const INITIAL_PERIOD_COUNT = 2;
const OVERVIEW_VIEW = { mode: "overview" } as const;

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
  const photoView = photoLocation?.view ?? OVERVIEW_VIEW;
  const periodModel = useMemo(
    () => buildPhotoWallPeriodModel(index, photoView),
    [index, photoView],
  );
  const loadedModel = useMemo(
    () => buildPhotoWallLoadedModel(index, monthCatalogs, periodModel.selectedAlbumId),
    [index, monthCatalogs, periodModel.selectedAlbumId],
  );

  useEffect(() => {
    for (const period of periodModel.visiblePeriods.slice(0, INITIAL_PERIOD_COUNT)) {
      void loadMonth(period).catch(() => undefined);
    }
  }, [loadMonth, periodModel.visiblePeriods]);

  useEffect(() => {
    if (photoView.mode !== "overview") {
      return;
    }
    for (const period of periodModel.overviewPeriods) {
      void loadMonth(period).catch(() => undefined);
    }
  }, [loadMonth, periodModel.overviewPeriods, photoView.mode]);

  const { activeMonth, wallRef, jumpToMonth } = useActivePhotoMonth(
    photoView.mode === "timeline",
    periodModel.visiblePeriods,
    loadMonth,
  );
  const preloadAdjacentPeriods = useCallback(
    (photo: PhotoRecord) => {
      if (!index) {
        return;
      }
      const currentMonth = monthFromCapturedAt(photo.capturedAt);
      const filteredIndex = periodModel.visiblePeriods.findIndex(
        (period) => period.month === currentMonth,
      );
      const periods = filteredIndex >= 0 ? periodModel.visiblePeriods : index.periods;
      const currentIndex = periods.findIndex((period) => period.month === currentMonth);
      for (const adjacentIndex of [currentIndex - 1, currentIndex + 1]) {
        const period = periods[adjacentIndex];
        if (period) {
          void loadMonth(period).catch(() => undefined);
        }
      }
    },
    [index, loadMonth, periodModel.visiblePeriods],
  );

  const closeMissingPhoto = useCallback(() => {
    navigate(planPhotoClose(window.location.href, history.state));
  }, [navigate]);
  const {
    state: photoSelection,
    selectedPhoto,
    displayPhoto,
    select: selectPhoto,
    dismiss: dismissPhoto,
    retry: retryPhotoSelection,
  } = usePhotoSelection({
    catalogReady: index !== null,
    photoId: photoLocation?.photoId,
    resolvePhoto,
    onMissing: closeMissingPhoto,
    onResolved: preloadAdjacentPeriods,
  });
  const lightboxPhotos =
    displayPhoto && loadedModel.filteredPhotos.some((photo) => photo.id === displayPhoto.id)
      ? loadedModel.filteredPhotos
      : loadedModel.allPhotos;

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

  return (
    <section className="pb-20">
      {catalogState.status === "loading" && <PhotoWallLoading />}
      {catalogState.status === "error" && (
        <PhotoWallError message={catalogState.message} onRetry={() => void loadCatalog()} />
      )}
      {catalogState.status === "ready" && photoView.mode === "overview" && (
        <PhotoOverview
          baseUrl={normalizedBaseUrl}
          albumCount={catalogState.index.albums.length}
          items={loadedModel.overviewItems}
          onOpenAlbum={openTimeline}
        />
      )}
      {catalogState.status === "ready" && photoView.mode === "timeline" && (
        <PhotoTimeline
          baseUrl={normalizedBaseUrl}
          index={catalogState.index}
          model={periodModel}
          monthCatalogs={monthCatalogs}
          monthErrors={monthErrors}
          activeMonth={activeMonth}
          wallRef={wallRef}
          onReturn={returnToOverview}
          onSelectAlbum={selectAlbum}
          onLoadMonth={(period) => void loadMonth(period).catch(() => undefined)}
          onRetryMonth={retryMonth}
          onOpenPhoto={openPhoto}
          onJumpMonth={(month) => void jumpToMonth(month)}
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

      {displayPhoto && index && (
        <PhotoLightbox
          baseUrl={normalizedBaseUrl}
          open={selectedPhoto !== null}
          photo={displayPhoto}
          photos={lightboxPhotos}
          albums={index.albums}
          onClose={closeLightbox}
          onSelect={selectLightboxPhoto}
        />
      )}
    </section>
  );
}
