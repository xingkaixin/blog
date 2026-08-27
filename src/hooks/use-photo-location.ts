import { useCallback, useEffect, useEffectEvent, useState } from "react";
import type { PhotoCatalogIndex } from "@/lib/photo-catalog";
import {
  applyPhotoNavigation,
  readPhotoLocation,
  type PhotoLocation,
  type PhotoNavigationPlan,
} from "@/lib/photo-location";

export function usePhotoLocation(index: PhotoCatalogIndex | null) {
  const [location, setLocation] = useState<PhotoLocation | null>(null);

  const syncFromUrl = useEffectEvent(() => {
    if (!index) {
      setLocation(null);
      return;
    }
    const nextLocation = readPhotoLocation(window.location.href, index);
    if (nextLocation.href !== window.location.href) {
      history.replaceState(history.state, "", nextLocation.href);
    }
    setLocation(nextLocation);
  });

  useEffect(() => {
    const pathname = window.location.pathname;
    const syncHistory = (event: PopStateEvent) => {
      if (window.location.pathname !== pathname) {
        return;
      }
      // 同页历史由照片浏览会话消费，跨页历史继续交给 Astro。
      event.stopImmediatePropagation();
      syncFromUrl();
    };
    const syncHash = () => {
      if (window.location.pathname === pathname) {
        syncFromUrl();
      }
    };

    window.addEventListener("popstate", syncHistory, true);
    window.addEventListener("hashchange", syncHash);
    return () => {
      window.removeEventListener("popstate", syncHistory, true);
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  useEffect(() => {
    syncFromUrl();
  }, [index]);

  const navigate = useCallback(
    (plan: PhotoNavigationPlan) => {
      if (!index) {
        return;
      }
      applyPhotoNavigation(plan, history);
      if (plan.history !== "back") {
        setLocation(readPhotoLocation(plan.href, index));
      }
    },
    [index],
  );

  return { location, navigate };
}
