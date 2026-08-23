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
  schemaVersion: 1,
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
  it("publishes concurrent month loads from one authoritative cache", async () => {
    const responses = new Map<string, unknown>([
      ["catalog/index.json", index],
      [periods[0].path, months[0]],
      [periods[1].path, months[1]],
    ]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const entry = [...responses].find(([suffix]) => requestUrl(url).endsWith(suffix));
      return jsonResponse(entry?.[1]);
    });

    await renderSession();
    await act(async () => {
      await Promise.all([session.loadMonth(periods[0]), session.loadMonth(periods[1])]);
    });

    expect(session.months).toEqual({
      [periods[0].month]: months[0],
      [periods[1].month]: months[1],
    });
    await expect(session.resolvePhoto(firstPhotoId)).resolves.toEqual(months[0].photos[0]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("discards a month response from a reloaded catalog generation", async () => {
    const staleMonth = deferred<Response>();
    let indexLoads = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (requestUrl(url).endsWith("catalog/index.json")) {
        indexLoads += 1;
        return jsonResponse(index);
      }
      return staleMonth.promise;
    });

    await renderSession();
    let staleLoad!: Promise<PhotoMonthCatalog>;
    await act(async () => {
      staleLoad = session.loadMonth(periods[0]);
      await session.reload();
    });
    await act(async () => {
      staleMonth.resolve(jsonResponse(months[0]));
      await staleLoad;
    });

    expect(indexLoads).toBe(2);
    expect(session.months).toEqual({});
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
