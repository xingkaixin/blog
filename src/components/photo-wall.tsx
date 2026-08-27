import { useEffect, useMemo } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoOverview, PhotoWallError, PhotoWallLoading } from "@/components/photo-overview";
import { PhotoTimeline } from "@/components/photo-timeline";
import { useActivePhotoMonth } from "@/hooks/use-active-photo-month";
import { usePhotoBrowsingSession } from "@/hooks/use-photo-browsing-session";
import { usePhotoCatalogSession } from "@/hooks/use-photo-catalog-session";
import { buildPhotoWallCatalogModel, buildPhotoWallModel } from "@/lib/photo-wall-model";

type PhotoWallProps = {
  baseUrl: string;
};

const INITIAL_PERIOD_COUNT = 2;

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
  const browsing = usePhotoBrowsingSession({
    index,
    months: monthCatalogs,
    monthErrors,
    loadMonth,
    resolvePhoto,
  });
  const photoView = browsing.view;
  const catalogModel = useMemo(
    () => buildPhotoWallCatalogModel(index, photoView),
    [index, photoView],
  );
  const model = useMemo(
    () => buildPhotoWallModel(catalogModel, monthCatalogs),
    [catalogModel, monthCatalogs],
  );

  useEffect(() => {
    for (const period of catalogModel.visiblePeriods.slice(0, INITIAL_PERIOD_COUNT)) {
      void loadMonth(period).catch(() => undefined);
    }
  }, [catalogModel.visiblePeriods, loadMonth]);

  useEffect(() => {
    if (photoView.mode !== "overview") {
      return;
    }
    for (const period of catalogModel.overviewPeriods) {
      void loadMonth(period).catch(() => undefined);
    }
  }, [catalogModel.overviewPeriods, loadMonth, photoView.mode]);

  const { activeMonth, wallRef, jumpToMonth } = useActivePhotoMonth(
    photoView.mode === "timeline",
    catalogModel.visiblePeriods,
    loadMonth,
  );
  const { selectionState: photoSelection, selectedPhoto, displayPhoto } = browsing;

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
          items={model.overviewItems}
          failedPeriods={catalogModel.overviewPeriods.filter(
            (period) => period.month in monthErrors,
          )}
          onRetryMonth={retryMonth}
          onOpenAlbum={browsing.openTimeline}
        />
      )}
      {catalogState.status === "ready" && photoView.mode === "timeline" && (
        <PhotoTimeline
          baseUrl={normalizedBaseUrl}
          model={model}
          monthCatalogs={monthCatalogs}
          monthErrors={monthErrors}
          activeMonth={activeMonth}
          wallRef={wallRef}
          onReturn={browsing.returnToOverview}
          onSelectAlbum={browsing.selectAlbum}
          onLoadMonth={(period) => void loadMonth(period).catch(() => undefined)}
          onRetryMonth={retryMonth}
          onOpenPhoto={browsing.openPhoto}
          onJumpMonth={jumpToMonth}
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
            onClick={browsing.retryPhoto}
            className="shrink-0 rounded-[6px] border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            重试
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
          onClose={browsing.closePhoto}
          onSelect={browsing.selectPhoto}
          onRetryNavigation={browsing.retryNavigation}
        />
      )}
    </section>
  );
}
