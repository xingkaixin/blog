// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoCatalogIndex, PhotoMonthCatalog, PhotoPeriod } from "@/lib/photo-catalog";
import { PhotoWall } from "./photo-wall";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/photos/");
  vi.spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("photo overview recovery", () => {
  it("refreshes the open photo and navigation when an adjacent month expires", async () => {
    const catalog = fixture(1, true, 3);
    const revision = "b".repeat(24);
    const latest = {
      ...catalog.index,
      periods: catalog.index.periods.map((period) => ({
        ...period,
        path: `catalog/months/${period.month}.${revision}.json`,
      })),
    };
    const months = catalog.months.map((month) => ({
      ...month,
      photos: month.photos.map((photo) => ({ ...photo, mediaRevision: revision })),
    }));
    const expiredMonth = Promise.withResolvers<Response>();
    let indexLoads = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("index.json")) {
        return Response.json(indexLoads++ === 0 ? catalog.index : latest);
      }
      if (url.endsWith(catalog.index.periods[2].path)) {
        return expiredMonth.promise;
      }
      const refreshed = latest.periods.findIndex((period) => url.endsWith(period.path));
      if (refreshed >= 0) {
        return Response.json(months[refreshed]);
      }
      const original = catalog.index.periods.findIndex((period) => url.endsWith(period.path));
      return Response.json(catalog.months[original]);
    });
    window.history.replaceState({}, "", "/photos/#album=trip");
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    await act(async () => root.render(<PhotoWall baseUrl="https://photos.example.com" />));
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>("[data-photo-id]")[1].click(),
    );
    expect(document.querySelector('[role="dialog"] img')).not.toBeNull();
    await act(async () => expiredMonth.resolve(new Response(null, { status: 404 })));
    expect(indexLoads).toBe(2);
    expect(document.querySelector<HTMLImageElement>('[role="dialog"] img')?.src).toContain(
      revision,
    );
    expect(document.querySelector('[aria-label="上一张照片"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="下一张照片"]')).not.toBeNull();
  });

  it("restarts visible pending months after another month refreshes the index", async () => {
    const catalog = fixture(1, true, 4);
    const latest = {
      ...catalog.index,
      periods: catalog.index.periods.map((period, index) =>
        index === 2
          ? { ...period, path: `catalog/months/${period.month}.${"b".repeat(24)}.json` }
          : period,
      ),
    };
    let indexLoads = 0;
    let fourthLoads = 0;
    class Observer {
      constructor(private callback: IntersectionObserverCallback) {}
      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("index.json")) {
        return Response.json(indexLoads++ === 0 ? catalog.index : latest);
      }
      if (url.endsWith(catalog.index.periods[2].path)) {
        return new Response(null, { status: 404 });
      }
      if (url.endsWith(catalog.index.periods[3].path) && fourthLoads++ === 0) {
        return new Promise((_resolve, reject) =>
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        );
      }
      const periodIndex = latest.periods.findIndex((period) => url.endsWith(period.path));
      return Response.json(catalog.months[periodIndex]);
    });
    window.history.replaceState({}, "", "/photos/#album=trip");
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    await act(async () => root.render(<PhotoWall baseUrl="https://photos.example.com" />));
    expect(indexLoads).toBe(2);
    expect(fourthLoads).toBe(2);
    expect(container.querySelectorAll("[data-photo-id]")).toHaveLength(4);
    expect(container.querySelector(".photo-period-placeholder")).toBeNull();
  });
  it("shows loading feedback while retrying adjacent lightbox photos", async () => {
    const catalog = fixture(1, true, 3);
    const pending = Promise.withResolvers<Response>();
    let attempts = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("index.json")) {
        return Response.json(catalog.index);
      }
      const periodIndex = catalog.index.periods.findIndex((period) => url.endsWith(period.path));
      if (periodIndex === 2) {
        return attempts++ === 0 ? new Response(null, { status: 500 }) : pending.promise;
      }
      return Response.json(catalog.months[periodIndex]);
    });
    window.history.replaceState({}, "", "/photos/#album=trip");
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    await act(async () => root.render(<PhotoWall baseUrl="https://photos.example.com" />));
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>("[data-photo-id]")[1].click(),
    );
    const retry = [...document.querySelectorAll<HTMLButtonElement>("footer button")].find(
      (button) => button.textContent === "重试",
    )!;
    await act(async () => retry.click());
    expect(document.body.textContent).toContain("正在加载相邻照片");
    await act(async () => pending.resolve(Response.json(catalog.months[2])));
  });
  it.each([false, true])(
    "retries failed previews without losing loaded photos (all failed: %s)",
    async (allFailed) => {
      const catalog = fixture();
      const failed = new Set(
        catalog.index.periods.slice(0, allFailed ? 2 : 1).map((period) => period.month),
      );
      const requests = serveCatalog(catalog, failed);
      await act(async () => root.render(<PhotoWall baseUrl="https://photos.example.com" />));
      const loadedSources = [...container.querySelectorAll("img")].map((image) => image.src);
      expect(loadedSources).toHaveLength(0);
      expect(container.querySelector('[role="alert"]')?.textContent).toContain("预览加载失败");
      const retry = [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "重试预览",
      )!;
      failed.clear();
      await act(async () => retry.click());
      expect(container.querySelector('[role="alert"]')).toBeNull();
      const sources = [...container.querySelectorAll("img")].map((image) => image.src);
      expect(sources).toHaveLength(4);
      expect(sources).toEqual(expect.arrayContaining(loadedSources));
      expect(window.location.search).toBe("");
      expect(requests.filter((url) => url.endsWith("index.json"))).toHaveLength(1);
      for (const [index, period] of catalog.index.periods.entries()) {
        expect(requests.filter((url) => url.endsWith(period.path))).toHaveLength(
          allFailed || index === 0 ? 2 : 1,
        );
      }
    },
  );

  it("does not report background month failures unrelated to overview previews", async () => {
    const catalog = fixture(4, false);
    serveCatalog(catalog, new Set([catalog.index.periods[1].month]));
    await act(async () => root.render(<PhotoWall baseUrl="https://photos.example.com" />));
    expect(console.error).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(8);
  });
});

it("lays out a restored timeline before resize notifications arrive", async () => {
  const catalog = fixture();
  serveCatalog(catalog, new Set());
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(ResizeObserver.prototype, "observe").mockImplementation(() => {});
  window.history.replaceState({}, "", "/photos/#album=trip");

  await act(async () => root.render(<PhotoWall baseUrl="https://photos.example.com" />));

  expect(container.querySelectorAll("[data-photo-id]")).toHaveLength(2);
  expect(container.querySelector(".photo-period-placeholder")).toBeNull();
});

function fixture(newestCount = 1, olderInAlbum = true, monthCount = 2) {
  const months: PhotoMonthCatalog[] = Array.from(
    { length: monthCount },
    (_, index) => `2026-${String(8 - index).padStart(2, "0")}`,
  ).map((month, monthIndex) => ({
    schemaVersion: 2,
    month,
    photos: Array.from({ length: monthIndex === 0 ? newestCount : 1 }, (_, photoIndex) => ({
      id: (monthIndex * 10 + photoIndex + 1).toString(16).padStart(32, "0"),
      capturedAt: `${month}-${20 - photoIndex}T12:00:00+08:00`,
      width: 1200,
      height: 800,
      albumIds: monthIndex === 0 || olderInAlbum ? ["trip"] : [],
      placeholderColor: "#112233",
    })),
  }));
  const index: PhotoCatalogIndex = {
    schemaVersion: 3,
    generatedAt: "2026-08-27T12:00:00.000Z",
    albums: [{ id: "trip", title: "旅行" }],
    periods: months.map(({ month, photos }): PhotoPeriod => ({
      month,
      count: photos.length,
      albumCounts: photos[0].albumIds.length > 0 ? { trip: photos.length } : {},
      path: `catalog/months/${month}.${"a".repeat(24)}.json`,
    })),
    photoMonths: Object.fromEntries(
      months.flatMap(({ month, photos }) => photos.map(({ id }) => [id, month])),
    ),
  };
  return { index, months };
}

function serveCatalog({ index, months }: ReturnType<typeof fixture>, failed: Set<string>) {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    requests.push(url);
    if (url.endsWith("index.json")) {
      return Response.json(index);
    }
    const period = index.periods.find((item) => url.endsWith(item.path));
    if (!period) {
      throw new Error(`Unexpected URL: ${url}`);
    }
    if (failed.has(period.month)) {
      return new Response("unavailable", { status: 500 });
    }
    return Response.json(months.find((month) => month.month === period.month));
  });
  return requests;
}
