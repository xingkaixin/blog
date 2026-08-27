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

    const visibleSections = new Set<Element>();
    const selectVisibleMonth = () => {
      if (window.scrollY <= 1) {
        setActiveMonth(periods[0].month);
        return;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1) {
        setActiveMonth(periods[periods.length - 1].month);
        return;
      }
      const nearest = [...visibleSections].toSorted(
        (left, right) =>
          Math.abs(left.getBoundingClientRect().top - 112) -
          Math.abs(right.getBoundingClientRect().top - 112),
      )[0];
      const month = nearest?.getAttribute("data-photo-month");
      if (month) {
        setActiveMonth((current) => (current === month ? current : month));
      }
    };
    const handleScrollEnd = () => {
      activeMonthLockRef.current = null;
      selectVisibleMonth();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.add(entry.target);
          } else {
            visibleSections.delete(entry.target);
          }
        }
        const lockedMonth = activeMonthLockRef.current;
        if (lockedMonth !== null) {
          const targetIsVisible = [...visibleSections].some(
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
    window.addEventListener("scrollend", handleScrollEnd);
    return () => {
      activeMonthLockRef.current = null;
      observer.disconnect();
      window.removeEventListener("scrollend", handleScrollEnd);
    };
  }, [enabled, periods]);

  const jumpToMonth = useCallback(
    (month: string) => {
      const period = periods.find((candidate) => candidate.month === month);
      if (!period) {
        return;
      }
      // 月份占位已在页面中，跳转不等待加载结果，避免旧请求改变当前位置。
      const target = document.getElementById(`photo-month-${month}`);
      setActiveMonth(month);
      activeMonthLockRef.current = activeMonth === month ? null : month;
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      void loadMonth(period).catch(() => undefined);
    },
    [activeMonth, loadMonth, periods],
  );

  return { activeMonth, wallRef, jumpToMonth };
}
