import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PhotoCatalogIndex,
  PhotoMonthCatalog,
  PhotoPeriod,
  PhotoRecord,
} from "@/lib/photo-catalog";
import {
  PhotoCatalogBrowser,
  PhotoCatalogNotFoundError,
  resolveCatalogPhoto,
} from "@/lib/photo-catalog-browser";

export type PhotoCatalogSessionState =
  | { status: "loading" }
  | { status: "ready"; index: PhotoCatalogIndex }
  | { status: "error"; message: string };

type MonthCatalogs = Record<string, PhotoMonthCatalog>;
type MonthErrors = Record<string, string>;

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePhotoCatalogSession(baseUrl: string) {
  const browser = useMemo(() => new PhotoCatalogBrowser(baseUrl), [baseUrl]);
  const [state, setState] = useState<PhotoCatalogSessionState>({ status: "loading" });
  const [months, setMonths] = useState<MonthCatalogs>({});
  const [monthErrors, setMonthErrors] = useState<MonthErrors>({});
  const monthsRef = useRef<MonthCatalogs>({});
  const requestControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const emptyMonths: MonthCatalogs = {};
    requestControllerRef.current = controller;
    monthsRef.current = emptyMonths;
    setMonths(emptyMonths);
    setMonthErrors({});
    return controller;
  }, []);

  const reload = useCallback(async () => {
    const controller = reset();
    setState({ status: "loading" });

    try {
      const index = await browser.loadIndex(controller.signal);
      if (!controller.signal.aborted) {
        setState({ status: "ready", index });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      console.error("加载照片 Catalog 失败", error);
      setState({ status: "error", message: readableError(error) });
    }
  }, [browser, reset]);

  useEffect(() => {
    void reload();
    return () => requestControllerRef.current?.abort();
  }, [reload]);

  const index = state.status === "ready" ? state.index : null;
  const loadMonth = useCallback(
    async (period: PhotoPeriod): Promise<PhotoMonthCatalog> => {
      const loaded = monthsRef.current[period.month];
      if (loaded) {
        return loaded;
      }
      const controller = requestControllerRef.current;
      try {
        if (!index || !controller) {
          throw new Error("照片主 Catalog 尚未加载");
        }
        const month = await browser.loadMonth(index, period, controller.signal);
        if (controller.signal.aborted) {
          return month;
        }
        const nextMonths = { ...monthsRef.current, [period.month]: month };
        monthsRef.current = nextMonths;
        setMonths(nextMonths);
        setMonthErrors((current) => {
          if (!(period.month in current)) {
            return current;
          }
          const next = { ...current };
          delete next[period.month];
          return next;
        });
        return month;
      } catch (error) {
        if (
          error instanceof PhotoCatalogNotFoundError &&
          controller &&
          !controller.signal.aborted
        ) {
          try {
            const latest = await browser.loadIndex(controller.signal);
            const replacement = latest.periods.find((item) => item.month === period.month);
            if (!controller.signal.aborted && replacement?.path !== period.path) {
              reset();
              setState({ status: "ready", index: latest });
            }
          } catch (refreshError) {
            if (!controller.signal.aborted) {
              console.error("刷新照片 Catalog 失败", refreshError);
            }
          }
        }
        if (controller && !controller.signal.aborted) {
          console.error(`加载照片月份 ${period.month} 失败`, error);
          setMonthErrors((current) => ({
            ...current,
            [period.month]: readableError(error),
          }));
        }
        throw error;
      }
    },
    [browser, index, reset],
  );

  const retryMonth = useCallback(
    (period: PhotoPeriod) => {
      setMonthErrors((current) => {
        const next = { ...current };
        delete next[period.month];
        return next;
      });
      void loadMonth(period).catch(() => undefined);
    },
    [loadMonth],
  );

  const resolvePhoto = useCallback(
    (photoId: string): Promise<PhotoRecord | null> => {
      if (!index) {
        return Promise.reject(new Error("照片主 Catalog 尚未加载"));
      }
      return resolveCatalogPhoto(index, photoId, monthsRef.current, loadMonth);
    },
    [index, loadMonth],
  );

  return {
    state,
    index,
    months,
    monthErrors,
    reload,
    loadMonth,
    retryMonth,
    resolvePhoto,
  };
}
