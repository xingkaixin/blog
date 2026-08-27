import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { PhotoCatalogIndex } from "@/lib/photo-catalog";
import {
  applyPhotoNavigation,
  readPhotoLocation,
  type PhotoLocation,
  type PhotoNavigationPlan,
} from "@/lib/photo-location";

export function usePhotoLocation(index: PhotoCatalogIndex | null) {
  const [location, setLocation] = useState<PhotoLocation | null>(null);
  const pendingScroll = useRef<ScrollToOptions | null>(null);

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
      pendingScroll.current = null;
      if (window.location.pathname !== pathname) {
        return;
      }
      // 同页历史由照片浏览会话消费，跨页历史继续交给 Astro。
      event.stopImmediatePropagation();
      pendingScroll.current = {
        left: event.state?.scrollX ?? 0,
        top: event.state?.scrollY ?? 0,
        behavior: "instant",
      };
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

  useLayoutEffect(() => {
    if (!location || !pendingScroll.current) {
      return undefined;
    }
    // 等新视图完成布局，避免旧总览的高度截断相册的滚动位置。
    const frame = window.requestAnimationFrame(() => {
      const position = pendingScroll.current;
      pendingScroll.current = null;
      if (position && window.location.href === location.href) {
        window.scrollTo(position);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location]);

  const navigate = useCallback(
    (plan: PhotoNavigationPlan, scroll: "top" | "preserve" = "preserve") => {
      if (!index) {
        return;
      }
      pendingScroll.current = null;
      const position = { scrollX: window.scrollX, scrollY: window.scrollY };
      history.replaceState({ ...history.state, ...position }, "");
      if (plan.history === "back") {
        applyPhotoNavigation(plan, history);
        return;
      }
      applyPhotoNavigation(
        {
          ...plan,
          state: {
            ...plan.state,
            ...(scroll === "top" ? { scrollX: 0, scrollY: 0 } : position),
          },
        },
        history,
      );
      setLocation(readPhotoLocation(plan.href, index));
      if (scroll === "top") {
        window.scrollTo({ left: 0, top: 0, behavior: "instant" });
      }
    },
    [index],
  );

  return { location, navigate };
}
