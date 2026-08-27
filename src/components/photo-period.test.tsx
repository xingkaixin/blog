// @vitest-environment happy-dom
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
