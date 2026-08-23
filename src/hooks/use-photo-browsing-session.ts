import { useCallback } from "react";
import { usePhotoLocation } from "@/hooks/use-photo-location";
import { usePhotoSelection } from "@/hooks/use-photo-selection";
import {
  monthFromCapturedAt,
  type PhotoCatalogIndex,
  type PhotoPeriod,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import {
  planOverviewOpen,
  planPhotoClose,
  planPhotoOpen,
  planPhotoSelection,
  planTimelineOpen,
  planTimelineSelection,
} from "@/lib/photo-location";

type UsePhotoBrowsingSessionOptions = {
  index: PhotoCatalogIndex | null;
  loadMonth: (period: PhotoPeriod) => Promise<unknown>;
  resolvePhoto: (photoId: string) => Promise<PhotoRecord | null>;
};

const OVERVIEW_VIEW = { mode: "overview" } as const;

export function usePhotoBrowsingSession({
  index,
  loadMonth,
  resolvePhoto,
}: UsePhotoBrowsingSessionOptions) {
  const { location, navigate } = usePhotoLocation(index);
  const view = location?.view ?? OVERVIEW_VIEW;

  const preloadAdjacentPeriods = useCallback(
    (photo: PhotoRecord) => {
      if (!index) {
        return;
      }
      const currentMonth = monthFromCapturedAt(photo.capturedAt);
      const currentIndex = index.periods.findIndex((period) => period.month === currentMonth);
      for (const adjacentIndex of [currentIndex - 1, currentIndex + 1]) {
        const period = index.periods[adjacentIndex];
        if (period) {
          void loadMonth(period).catch(() => undefined);
        }
      }
    },
    [index, loadMonth],
  );

  const closeMissingPhoto = useCallback(() => {
    navigate(planPhotoClose(window.location.href, window.history.state));
  }, [navigate]);
  const {
    state: selectionState,
    selectedPhoto,
    displayPhoto,
    retry: retryPhoto,
    select,
    dismiss,
  } = usePhotoSelection({
    catalogReady: index !== null,
    photoId: location?.photoId,
    resolvePhoto,
    onMissing: closeMissingPhoto,
    onResolved: preloadAdjacentPeriods,
  });

  const openPhoto = useCallback(
    (photo: PhotoRecord) => {
      navigate(planPhotoOpen(window.location.href, window.history.state, photo.id));
      select(photo);
    },
    [navigate, select],
  );
  const selectPhoto = useCallback(
    (photo: PhotoRecord) => {
      navigate(planPhotoSelection(window.location.href, window.history.state, photo.id));
      select(photo);
    },
    [navigate, select],
  );
  const closePhoto = useCallback(() => {
    // 先切换本地状态以立即播放退出动画，URL 随后收敛到同一结果。
    dismiss();
    navigate(planPhotoClose(window.location.href, window.history.state));
  }, [dismiss, navigate]);
  const openTimeline = useCallback(
    (albumId: string | null) => {
      navigate(planTimelineOpen(window.location.href, window.history.state, albumId));
      window.scrollTo(0, 0);
    },
    [navigate],
  );
  const selectAlbum = useCallback(
    (albumId: string | null) => {
      navigate(planTimelineSelection(window.location.href, window.history.state, albumId));
      window.scrollTo(0, 0);
    },
    [navigate],
  );
  const returnToOverview = useCallback(() => {
    dismiss();
    navigate(planOverviewOpen(window.location.href, window.history.state));
    window.scrollTo(0, 0);
  }, [dismiss, navigate]);

  return {
    view,
    selectionState,
    selectedPhoto,
    displayPhoto,
    retryPhoto,
    openPhoto,
    selectPhoto,
    closePhoto,
    openTimeline,
    selectAlbum,
    returnToOverview,
  };
}
