// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PhotoMonthCatalog } from "@/lib/photo-catalog";
import { PhotoPeriodSection } from "./photo-period";

const monthCatalog: PhotoMonthCatalog = {
  schemaVersion: 2,
  month: "2026-08",
  photos: [
    { width: 900, height: 1600 },
    { width: 1600, height: 900 },
    { width: 1200, height: 1200 },
  ].map((dimensions, index) => ({
    ...dimensions,
    id: String(index).repeat(32),
    capturedAt: "2026-08-20T12:00:00.000+08:00",
    albumIds: [],
    placeholderColor: "#abcdef",
  })),
};

describe("photo period", () => {
  it("keeps its observer across unrelated renders and renews it for a catalog reset", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const instances: {
      callback: IntersectionObserverCallback;
      disconnect: ReturnType<typeof vi.fn>;
    }[] = [];
    class Observer {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(callback: IntersectionObserverCallback) {
        instances.push({ callback, disconnect: this.disconnect });
      }
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    const period = {
      month: monthCatalog.month,
      count: 3,
      albumCounts: {},
      path: "catalog/months/2026-08.aaaaaaaaaaaaaaaaaaaaaaaa.json",
    };
    const props = {
      baseUrl: "/photos",
      period,
      albumId: null,
      eager: false,
      containerWidth: 800,
      onRetry: vi.fn(),
      onOpenPhoto: vi.fn(),
    };
    const onVisible = vi.fn();
    try {
      await act(async () => root.render(<PhotoPeriodSection {...props} onVisible={vi.fn()} />));
      await act(async () =>
        root.render(<PhotoPeriodSection {...props} containerWidth={900} onVisible={onVisible} />),
      );
      expect(instances).toHaveLength(1);
      expect(container.querySelector('[role="status"]')?.getAttribute("aria-label")).toContain(
        "正在加载",
      );
      await act(async () =>
        instances[0].callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      );
      expect(onVisible).toHaveBeenCalledOnce();
      expect(instances[0].disconnect).not.toHaveBeenCalled();
      await act(async () =>
        root.render(<PhotoPeriodSection {...props} period={{ ...period }} onVisible={onVisible} />),
      );
      expect(instances).toHaveLength(2);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  });
  it.each([800, 1040])("matches image sizes to tiles in a %ipx container", (containerWidth) => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <PhotoPeriodSection
        baseUrl="/photos"
        period={{
          month: monthCatalog.month,
          count: monthCatalog.photos.length,
          albumCounts: {},
          path: "catalog/months/2026-08.aaaaaaaaaaaaaaaaaaaaaaaa.json",
        }}
        monthCatalog={monthCatalog}
        albumId={null}
        eager={false}
        containerWidth={containerWidth}
        onVisible={vi.fn()}
        onRetry={vi.fn()}
        onOpenPhoto={vi.fn()}
      />,
    );

    const tiles = container.querySelectorAll<HTMLButtonElement>("[data-photo-id]");
    expect(tiles).toHaveLength(monthCatalog.photos.length);
    for (const tile of tiles) {
      const desktopSize = tile.querySelector("img")?.sizes.split(",").at(-1)?.trim();
      const layoutWidth = tile.style.getPropertyValue("--photo-width");
      expect(desktopSize).toBe(layoutWidth);
    }
  });
});
