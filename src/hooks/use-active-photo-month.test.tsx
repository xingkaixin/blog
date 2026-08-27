// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoMonthCatalog, PhotoPeriod } from "@/lib/photo-catalog";
import { useActivePhotoMonth } from "./use-active-photo-month";

const periods: PhotoPeriod[] = ["2026-08", "2026-06", "2026-04"].map((month) => ({
  month,
  count: 1,
  albumCounts: {},
  path: `catalog/months/${month}.${"a".repeat(24)}.json`,
}));

type Options = {
  enabled?: boolean;
  visiblePeriods?: PhotoPeriod[];
  loadMonth: (period: PhotoPeriod) => Promise<PhotoMonthCatalog>;
};

let root: Root;
let container: HTMLDivElement;
let session: ReturnType<typeof useActivePhotoMonth>;
let scrolledMonths: string[];

function Harness({ enabled = true, visiblePeriods = periods, loadMonth }: Options) {
  session = useActivePhotoMonth(enabled, visiblePeriods, loadMonth);
  return enabled ? (
    <div ref={session.wallRef}>
      {visiblePeriods.map((period) => (
        <section
          key={period.month}
          id={`photo-month-${period.month}`}
          data-photo-month={period.month}
        />
      ))}
    </div>
  ) : null;
}

async function renderSession(options: Options) {
  await act(async () => root.render(<Harness {...options} />));
}

function deferredMonth(month: string) {
  let finish: () => void = () => undefined;
  const promise = new Promise<PhotoMonthCatalog>((resolve) => {
    finish = () => resolve({ schemaVersion: 2, month, photos: [] });
  });
  return { promise, finish };
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  scrolledMonths = [];
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
    function (this: HTMLElement) {
      scrolledMonths.push(this.id);
    },
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("useActivePhotoMonth", () => {
  it("keeps the latest jump when an earlier month request finishes later", async () => {
    const april = deferredMonth("2026-04");
    const june = deferredMonth("2026-06");
    await renderSession({
      loadMonth: (period) => (period.month === "2026-04" ? april.promise : june.promise),
    });

    await act(async () => {
      session.jumpToMonth("2026-04");
      session.jumpToMonth("2026-06");
    });
    await act(async () => june.finish());
    await act(async () => april.finish());

    expect(session.activeMonth).toBe("2026-06");
    expect(scrolledMonths.at(-1)).toBe("photo-month-2026-06");
  });

  it("jumps to the existing placeholder without waiting for the network", async () => {
    const april = deferredMonth("2026-04");
    await renderSession({ loadMonth: () => april.promise });

    await act(async () => {
      session.jumpToMonth("2026-04");
    });

    expect(session.activeMonth).toBe("2026-04");
    expect(scrolledMonths).toEqual(["photo-month-2026-04"]);
    await act(async () => april.finish());
    expect(scrolledMonths).toHaveLength(1);
  });

  it("does not restore a pending jump after the timeline changes", async () => {
    const april = deferredMonth("2026-04");
    const loadMonth = () => april.promise;
    await renderSession({ loadMonth });
    await act(async () => {
      session.jumpToMonth("2026-04");
    });
    await renderSession({ enabled: false, visiblePeriods: [periods[0]], loadMonth });
    scrolledMonths.length = 0;

    await act(async () => april.finish());

    expect(session.activeMonth).toBe("2026-08");
    expect(scrolledMonths).toEqual([]);
  });

  it("keeps a failed month as a jump target and ignores unknown months", async () => {
    const loadMonth = vi.fn().mockRejectedValue(new Error("offline"));
    await renderSession({ loadMonth });

    await act(async () => {
      session.jumpToMonth("2026-04");
    });
    await act(async () => {
      session.jumpToMonth("2025-01");
    });

    expect(session.activeMonth).toBe("2026-04");
    expect(scrolledMonths).toEqual(["photo-month-2026-04"]);
    expect(loadMonth).toHaveBeenCalledTimes(1);
  });
});
