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
});

describe("photo overview recovery", () => {
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
      expect(loadedSources).toHaveLength(allFailed ? 0 : 2);
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

function fixture(newestCount = 1, olderInAlbum = true) {
  const months: PhotoMonthCatalog[] = ["2026-08", "2026-07"].map((month, monthIndex) => ({
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
