import { useCallback, useEffect, useMemo } from "react";
import { usePhotoLocation } from "@/hooks/use-photo-location";
import { usePhotoSelection } from "@/hooks/use-photo-selection";
import {
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
} from "@/lib/photo-catalog";
import { planPhotoNavigation, type PhotoNavigation } from "@/lib/photo-catalog-browser";
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
  months: Readonly<Record<string, PhotoMonthCatalog>>;
  monthErrors: Readonly<Record<string, string>>;
  loadMonth: (period: PhotoPeriod) => Promise<unknown>;
  resolvePhoto: (photoId: string) => Promise<PhotoRecord | null>;
};

export type PhotoBrowsingNavigation = PhotoNavigation & {
  status: "ready" | "loading" | "error";
};

const OVERVIEW_VIEW = { mode: "overview" } as const;

export function usePhotoBrowsingSession({
  index,
  months,
  monthErrors,
  loadMonth,
  resolvePhoto,
}: UsePhotoBrowsingSessionOptions) {
  const { location, navigate } = usePhotoLocation(index);
  const view = location?.view ?? OVERVIEW_VIEW;

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
  });

  const albumId = view.mode === "timeline" ? view.albumId : null;
  const navigationPlan = useMemo(
    () =>
      index && displayPhoto ? planPhotoNavigation(index, displayPhoto, albumId, months) : null,
    [albumId, displayPhoto, index, months],
  );
  const loadNavigation = useCallback(
    (retry = false) => {
      if (!selectedPhoto || !navigationPlan) {
        return;
      }
      for (const period of navigationPlan.pendingPeriods) {
        if (retry || !monthErrors[period.month]) {
          void loadMonth(period).catch(() => undefined);
        }
      }
    },
    [loadMonth, monthErrors, navigationPlan, selectedPhoto],
  );

  useEffect(() => loadNavigation(), [loadNavigation]);

  const navigation: PhotoBrowsingNavigation | null = navigationPlan && {
    ...navigationPlan.navigation,
    status: navigationPlan.pendingPeriods.some((period) => monthErrors[period.month])
      ? "error"
      : navigationPlan.pendingPeriods.length > 0
        ? "loading"
        : "ready",
  };

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
    navigation,
    retryNavigation: () => loadNavigation(true),
    retryPhoto,
    openPhoto,
    selectPhoto,
    closePhoto,
    openTimeline,
    selectAlbum,
    returnToOverview,
  };
}
