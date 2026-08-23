import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhotoCatalogBrowser, resolveCatalogPhoto } from "@/lib/photo-browser";
import type {
  PhotoCatalogIndex,
  PhotoMonthCatalog,
  PhotoPeriod,
  PhotoRecord,
} from "@/lib/photo-catalog";

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
  const generationRef = useRef(0);

  const reload = useCallback(async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = generationRef.current + 1;
    requestControllerRef.current = controller;
    generationRef.current = generation;
    monthsRef.current = {};
    setMonths({});
    setMonthErrors({});
    setState({ status: "loading" });

    try {
      const index = await browser.loadIndex(controller.signal);
      if (generationRef.current === generation) {
        setState({ status: "ready", index });
      }
    } catch (error) {
      if (controller.signal.aborted || generationRef.current !== generation) {
        return;
      }
      console.error("加载照片 Catalog 失败", error);
      setState({ status: "error", message: readableError(error) });
    }
  }, [browser]);

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
      const generation = generationRef.current;
      try {
        if (!index) {
          throw new Error("照片主 Catalog 尚未加载");
        }
        const month = await browser.loadMonth(index, period, requestControllerRef.current?.signal);
        if (generationRef.current !== generation) {
          return month;
        }
        setMonths((current) => {
          const next = { ...current, [period.month]: month };
          monthsRef.current = next;
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
        return month;
      } catch (error) {
        if (generationRef.current === generation && !requestControllerRef.current?.signal.aborted) {
          console.error(`加载照片月份 ${period.month} 失败`, error);
          setMonthErrors((current) => ({
            ...current,
            [period.month]: readableError(error),
          }));
        }
        throw error;
      }
    },
    [browser, index],
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
      return resolveCatalogPhoto(index, photoId, Object.values(monthsRef.current), loadMonth);
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
