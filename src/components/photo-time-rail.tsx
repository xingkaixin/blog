import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { PhotoPeriod } from "@/lib/photo-catalog";

type PhotoTimeRailProps = {
  periods: PhotoPeriod[];
  activeMonth: string;
  onSelect: (month: string) => void;
};

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
}

function periodIndexFromPointer(
  element: HTMLElement,
  clientY: number,
  periodCount: number,
): number {
  const rect = element.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  return Math.round(ratio * (periodCount - 1));
}

export function PhotoTimeRail({ periods, activeMonth, onSelect }: PhotoTimeRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const labelPositionRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const previewIndexRef = useRef(0);
  const activeIndex = Math.max(
    0,
    periods.findIndex((period) => period.month === activeMonth),
  );

  const updateVisual = useCallback(
    (index: number) => {
      const rail = railRef.current;
      const marker = markerRef.current;
      const labelPosition = labelPositionRef.current;
      const label = labelRef.current;
      if (!rail || !marker || !labelPosition || !label || periods.length === 0) {
        return;
      }

      const boundedIndex = Math.min(periods.length - 1, Math.max(0, index));
      const ratio = periods.length === 1 ? 0 : boundedIndex / (periods.length - 1);
      const travel = Math.max(0, rail.clientHeight - marker.offsetHeight);
      const markerY = ratio * travel;
      const labelY = ratio * rail.clientHeight;

      marker.style.transform = `translate3d(0, ${markerY}px, 0)`;
      labelPosition.style.transform = `translate3d(0, ${labelY}px, 0)`;
      label.textContent = formatMonth(periods[boundedIndex].month);
      rail.setAttribute("aria-valuenow", String(boundedIndex));
      rail.setAttribute("aria-valuetext", formatMonth(periods[boundedIndex].month));
      previewIndexRef.current = boundedIndex;
    },
    [periods],
  );

  useEffect(() => {
    updateVisual(activeIndex);
  }, [activeIndex, updateVisual]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      return undefined;
    }
    const observer = new ResizeObserver(() => updateVisual(previewIndexRef.current));
    observer.observe(rail);
    return () => observer.disconnect();
  }, [updateVisual]);

  if (periods.length < 2) {
    return null;
  }

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    updateVisual(periodIndexFromPointer(event.currentTarget, event.clientY, periods.length));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
    updateFromPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      updateFromPointer(event);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    updateFromPointer(event);
    event.currentTarget.releasePointerCapture(event.pointerId);
    delete event.currentTarget.dataset.dragging;
    onSelect(periods[previewIndexRef.current].month);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    delete event.currentTarget.dataset.dragging;
    updateVisual(activeIndex);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextIndex = activeIndex;
    if (event.key === "ArrowUp") {
      nextIndex -= 1;
    } else if (event.key === "ArrowDown") {
      nextIndex += 1;
    } else if (event.key === "PageUp") {
      nextIndex -= 12;
    } else if (event.key === "PageDown") {
      nextIndex += 12;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = periods.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const boundedIndex = Math.min(periods.length - 1, Math.max(0, nextIndex));
    updateVisual(boundedIndex);
    onSelect(periods[boundedIndex].month);
  };

  const yearMarkers = periods.filter(
    (period, index) =>
      index === 0 || periods[index - 1].month.slice(0, 4) !== period.month.slice(0, 4),
  );

  return (
    <aside
      aria-label="照片时间线"
      className="pointer-events-none fixed bottom-6 right-1 top-24 z-10 flex w-8 justify-center md:right-3 md:w-12 lg:right-5"
    >
      <div
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label="按月份跳转"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={periods.length - 1}
        aria-valuenow={activeIndex}
        aria-valuetext={formatMonth(periods[activeIndex].month)}
        className="group pointer-events-auto relative h-full w-7 cursor-ns-resize touch-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 md:w-9"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1/2 top-1 w-px -translate-x-1/2 bg-ink-300"
        />
        {periods.map((period, index) => (
          <span
            key={period.month}
            aria-hidden="true"
            className="absolute left-1/2 h-px w-1.5 -translate-x-1/2 bg-ink-400"
            style={{ top: `${(index / (periods.length - 1)) * 100}%` }}
          />
        ))}
        {yearMarkers.map((period) => {
          const index = periods.indexOf(period);
          return (
            <span
              key={period.month}
              aria-hidden="true"
              className="absolute right-6 hidden -translate-y-1/2 font-mono text-[0.6rem] text-ink-400 md:block"
              style={{ top: `${(index / (periods.length - 1)) * 100}%` }}
            >
              {period.month.slice(0, 4)}
            </span>
          );
        })}
        <span
          ref={markerRef}
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-paper bg-accent shadow-sm will-change-transform"
        />
        <span
          ref={labelPositionRef}
          aria-hidden="true"
          className="absolute right-full top-0 mr-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-data-[dragging=true]:opacity-100 md:opacity-100"
        >
          <span
            ref={labelRef}
            className="block -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-paper/95 px-2.5 py-1 font-mono text-[0.65rem] text-ink-700 shadow-sm backdrop-blur"
          />
        </span>
      </div>
    </aside>
  );
}
