import { useCallback, useEffect, useRef, useState } from "react";
import type { PhotoMonthCatalog, PhotoPeriod } from "@/lib/photo-catalog";

export function useActivePhotoMonth(
  enabled: boolean,
  periods: PhotoPeriod[],
  loadMonth: (period: PhotoPeriod) => Promise<PhotoMonthCatalog>,
) {
  const [activeMonth, setActiveMonth] = useState("");
  const wallRef = useRef<HTMLDivElement>(null);
  const activeMonthLockRef = useRef<string | null>(null);

  useEffect(() => {
    if (periods.length === 0) {
      setActiveMonth("");
      return;
    }
    setActiveMonth((current) =>
      periods.some((period) => period.month === current) ? current : periods[0].month,
    );
  }, [periods]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const wall = wallRef.current;
    if (!wall || periods.length === 0) {
      return undefined;
    }

    const visibleEntries = new Map<Element, IntersectionObserverEntry>();
    const selectVisibleMonth = () => {
      if (window.scrollY <= 1) {
        setActiveMonth(periods[0].month);
        return;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1) {
        setActiveMonth(periods[periods.length - 1].month);
        return;
      }
      const nearest = [...visibleEntries.values()].toSorted(
        (left, right) =>
          Math.abs(left.boundingClientRect.top - 112) -
          Math.abs(right.boundingClientRect.top - 112),
      )[0];
      const month = nearest?.target.getAttribute("data-photo-month");
      if (month) {
        setActiveMonth((current) => (current === month ? current : month));
      }
    };
    const releaseActiveMonthLock = () => {
      if (activeMonthLockRef.current === null) {
        return;
      }
      activeMonthLockRef.current = null;
      selectVisibleMonth();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleEntries.set(entry.target, entry);
          } else {
            visibleEntries.delete(entry.target);
          }
        }
        const lockedMonth = activeMonthLockRef.current;
        if (lockedMonth !== null) {
          const targetIsVisible = [...visibleEntries.keys()].some(
            (entry) => entry.getAttribute("data-photo-month") === lockedMonth,
          );
          if (!targetIsVisible) {
            return;
          }
          activeMonthLockRef.current = null;
          setActiveMonth(lockedMonth);
          return;
        }
        selectVisibleMonth();
      },
      { rootMargin: "-90px 0px -68% 0px", threshold: 0 },
    );

    for (const section of wall.querySelectorAll("[data-photo-month]")) {
      observer.observe(section);
    }
    window.addEventListener("scrollend", releaseActiveMonthLock);
    return () => {
      activeMonthLockRef.current = null;
      observer.disconnect();
      window.removeEventListener("scrollend", releaseActiveMonthLock);
    };
  }, [enabled, periods]);

  const jumpToMonth = useCallback(
    async (month: string) => {
      const period = periods.find((candidate) => candidate.month === month);
      if (!period) {
        return;
      }
      try {
        await loadMonth(period);
      } catch {
        // 月份内的错误状态仍然是一个有效的跳转目标。
      }
      const target = document.getElementById(`photo-month-${month}`);
      setActiveMonth(month);
      activeMonthLockRef.current = activeMonth === month ? null : month;
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    },
    [activeMonth, loadMonth, periods],
  );

  return { activeMonth, wallRef, jumpToMonth };
}
