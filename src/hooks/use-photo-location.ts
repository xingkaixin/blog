import { useCallback, useEffect, useState } from "react";
import type { PhotoCatalogIndex } from "@/lib/photo-catalog";
import {
  applyPhotoNavigation,
  readPhotoLocation,
  type PhotoLocation,
  type PhotoNavigationPlan,
} from "@/lib/photo-location";

export function usePhotoLocation(index: PhotoCatalogIndex | null) {
  const [location, setLocation] = useState<PhotoLocation | null>(null);

  useEffect(() => {
    if (!index) {
      setLocation(null);
      return undefined;
    }

    const syncFromUrl = () => {
      const nextLocation = readPhotoLocation(window.location.href, index);
      if (nextLocation.href !== window.location.href) {
        history.replaceState(history.state, "", nextLocation.href);
      }
      setLocation(nextLocation);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("hashchange", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("hashchange", syncFromUrl);
    };
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
