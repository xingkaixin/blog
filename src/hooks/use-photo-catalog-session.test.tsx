// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoCatalogIndex, PhotoMonthCatalog, PhotoPeriod } from "@/lib/photo-catalog";
import { usePhotoCatalogSession } from "./use-photo-catalog-session";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const firstPhotoId = "11111111111111111111111111111111";
const secondPhotoId = "22222222222222222222222222222222";
const periods: PhotoPeriod[] = [period("2026-04", firstPhotoId), period("2026-03", secondPhotoId)];
const index: PhotoCatalogIndex = {
  schemaVersion: 3,
  generatedAt: "2026-08-23T09:00:00.000Z",
  albums: [],
  periods,
  photoMonths: {
    [firstPhotoId]: periods[0].month,
    [secondPhotoId]: periods[1].month,
  },
};
const months = periods.map((item, itemIndex): PhotoMonthCatalog => ({
  schemaVersion: 2,
  month: item.month,
  photos: [
    {
      id: itemIndex === 0 ? firstPhotoId : secondPhotoId,
      capturedAt: `${item.month}-20T12:00:00.000+08:00`,
      width: 1200,
      height: 800,
      albumIds: [],
      placeholderColor: "#abcdef",
    },
  ],
}));

type Session = ReturnType<typeof usePhotoCatalogSession>;

let root: Root;
let container: HTMLDivElement;
let session: Session;

function Harness() {
  session = usePhotoCatalogSession("https://photos.example.com");
  return null;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("usePhotoCatalogSession", () => {
  it.each([404, 410])("refreshes an expired month reference after HTTP %s", async (status) => {
    const replacement = { ...periods[0], path: `catalog/months/2026-04.${"f".repeat(24)}.json` };
    const latest = { ...index, periods: [replacement, periods[1]] };
    let indexLoads = 0;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (requestUrl(url).endsWith("catalog/index.json")) {
        return jsonResponse(indexLoads++ === 0 ? index : latest);
      }
      return requestUrl(url).endsWith(replacement.path)
        ? jsonResponse(months[0])
        : new Response(null, { status });
    });

    await renderSession();
    await act(async () => {
      await session.resolvePhoto(firstPhotoId).catch(() => undefined);
    });
    expect(session.index).toEqual(latest);
    expect(session.monthErrors).toEqual({});
    await act(async () => {
      await expect(session.resolvePhoto(firstPhotoId)).resolves.toEqual(months[0].photos[0]);
    });
    expect(indexLoads).toBe(2);
  });

  it("resolves a retired photo as missing after refreshing its removed month", async () => {
    const latest = {
      ...index,
      periods: [periods[1]],
      photoMonths: { [secondPhotoId]: periods[1].month },
    };
    let indexLoads = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (requestUrl(url).endsWith("catalog/index.json")) {
        return jsonResponse(indexLoads++ === 0 ? index : latest);
      }
      return jsonResponse(undefined);
    });
    await renderSession();
    await act(async () => {
      await session.resolvePhoto(firstPhotoId).catch(() => undefined);
    });
    expect(session.index).toEqual(latest);
    await expect(session.resolvePhoto(firstPhotoId)).resolves.toBeNull();
  });
});

async function renderSession() {
  await act(async () => root.render(<Harness />));
  expect(session.state.status).toBe("ready");
}

function period(month: string, photoId: string): PhotoPeriod {
  return {
    month,
    count: 1,
    albumCounts: {},
    path: `catalog/months/${month}.${photoId.slice(0, 24)}.json`,
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: value === undefined ? 404 : 200,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}
