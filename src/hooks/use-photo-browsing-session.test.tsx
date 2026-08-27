// @vitest-environment happy-dom

import { fileURLToPath } from "node:url";
import type { BuildConfig } from "bun";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PhotoCatalogIndex,
  PhotoMonthCatalog,
  PhotoPeriod,
  PhotoRecord,
} from "@/lib/photo-catalog";
import { usePhotoBrowsingSession } from "./use-photo-browsing-session";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const photo: PhotoRecord = {
  id: "0123456789abcdef0123456789abcdef",
  capturedAt: "2026-04-25T21:12:30.244+07:00",
  width: 3024,
  height: 4032,
  albumIds: ["trip"],
  placeholderColor: "#4f5f6a",
};
const periods: PhotoPeriod[] = ["2026-05", "2026-04", "2026-03"].map((month) => ({
  month,
  count: 1,
  albumCounts: { trip: 1 },
  path: `catalog/months/${month}.0123456789abcdef01234567.json`,
}));
const months = Object.fromEntries(periods.map((period) => [period.month, monthCatalog(period)]));
const index: PhotoCatalogIndex = {
  schemaVersion: 3,
  generatedAt: "2026-08-07T12:00:00.000Z",
  albums: [{ id: "trip", title: "旅行" }],
  periods,
  photoMonths: Object.fromEntries(
    Object.values(months).map((month) => [month.photos[0].id, month.month]),
  ),
};

type BrowsingOptions = Parameters<typeof usePhotoBrowsingSession>[0];
type BrowsingSession = ReturnType<typeof usePhotoBrowsingSession>;

let root: Root;
let container: HTMLDivElement;
let session: BrowsingSession;

function Harness(options: BrowsingOptions) {
  session = usePhotoBrowsingSession(options);
  return null;
}

async function renderSession(options: BrowsingOptions) {
  await act(async () => root.render(<Harness {...options} />));
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/photos/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("usePhotoBrowsingSession", () => {
  it("restores each view's scroll position on same-page history traversal", async () => {
    let scrollY = 0;
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    vi.spyOn(window, "scrollTo").mockImplementation(
      (left?: number | ScrollToOptions, top?: number) => {
        scrollY = typeof left === "object" ? (left.top ?? scrollY) : (top ?? scrollY);
      },
    );
    history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, "", "/photos/");
    const removeRouter = await installAstroRouter();
    try {
      await renderSession({
        index,
        months,
        monthErrors: {},
        loadMonth: vi.fn(async () => undefined),
        resolvePhoto: vi.fn().mockResolvedValue(photo),
      });
      scrollY = 420;
      await act(async () => session.openTimeline("trip"));
      expect(scrollY).toBe(0);
      scrollY = 1600;
      window.dispatchEvent(new Event("scrollend"));

      await travel(() => history.back(), "");
      await vi.waitFor(() => expect(scrollY).toBe(420));
      expect(session.view).toEqual({ mode: "overview" });

      await travel(() => history.forward(), "#album=trip");
      await vi.waitFor(() => expect(scrollY).toBe(1600));
      expect(session.view).toEqual({ mode: "timeline", albumId: "trip" });
    } finally {
      removeRouter();
    }
  });

  it("waits for the catalog before restoring a pending history position", async () => {
    const options: BrowsingOptions = {
      index,
      months,
      monthErrors: {},
      loadMonth: vi.fn(async () => undefined),
      resolvePhoto: vi.fn().mockResolvedValue(photo),
    };
    await renderSession(options);
    await act(async () => session.openTimeline("trip"));
    history.replaceState({ ...history.state, scrollY: 1600 }, "");
    await renderSession({ ...options, index: null });
    const scrollTo = vi.spyOn(window, "scrollTo").mockClear();

    await travel(() => history.back(), "");
    await travel(() => history.forward(), "#album=trip");
    expect(scrollTo).not.toHaveBeenCalled();
    await renderSession(options);
    await vi.waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 1600, behavior: "instant" }),
    );
    expect(session.view).toEqual({ mode: "timeline", albumId: "trip" });
  });

  it("loads adjacent months within the selected album", async () => {
    const sparsePeriods: PhotoPeriod[] = [
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
      "2026-04",
    ].map((month, index): PhotoPeriod => ({
      month,
      count: 1,
      albumCounts: index % 2 === 0 ? { trip: 1 } : {},
      path: `catalog/months/${month}.0123456789abcdef01234567.json`,
    }));
    const sparseMonths = Object.fromEntries(
      sparsePeriods.map((period) => [period.month, monthCatalog(period)]),
    );
    const selected = sparseMonths["2026-06"].photos[0];
    const sparseIndex = {
      ...index,
      periods: sparsePeriods,
      photoMonths: Object.fromEntries(
        Object.values(sparseMonths).map((month) => [month.photos[0].id, month.month]),
      ),
    };
    const loadMonth = vi.fn(async (_period: PhotoPeriod) => undefined);
    const options: BrowsingOptions = {
      index: sparseIndex,
      months: { "2026-06": sparseMonths["2026-06"] },
      monthErrors: {},
      loadMonth,
      resolvePhoto: async (photoId) => sparseMonths[sparseIndex.photoMonths[photoId]].photos[0],
    };

    await renderSession(options);
    await act(async () => session.openTimeline("trip"));
    await act(async () => session.openPhoto(selected));

    const requestedMonths = loadMonth.mock.calls.map(([period]) => period.month);
    expect(requestedMonths).toEqual(["2026-08", "2026-04"]);
    expect(session.navigation).toEqual({
      previous: undefined,
      next: undefined,
      position: 2,
      total: 3,
      status: "loading",
    });

    await renderSession({ ...options, months: sparseMonths });
    expect(session.navigation).toMatchObject({
      previous: sparseMonths["2026-08"].photos[0],
      next: sparseMonths["2026-04"].photos[0],
      status: "ready",
    });
    await act(async () => session.selectPhoto(session.navigation!.next!));
    expect(session.navigation).toMatchObject({ position: 3, total: 3, next: undefined });
    expect(window.location.hash).toContain(`photo=${sparseMonths["2026-04"].photos[0].id}`);
  });

  it("keeps the current photo visible while a failed adjacent month is retried", async () => {
    const loadMonth = vi.fn(async (_period: PhotoPeriod) => undefined);
    const options: BrowsingOptions = {
      index,
      months: { "2026-04": months["2026-04"] },
      monthErrors: { "2026-03": "offline" },
      loadMonth,
      resolvePhoto: vi.fn().mockResolvedValue(photo),
    };
    await renderSession(options);
    await act(async () => session.openPhoto(photo));
    expect(session.navigation?.status).toBe("error");
    expect(session.selectedPhoto).toEqual(photo);
    expect(loadMonth).not.toHaveBeenCalledWith(periods[2]);

    await act(async () => session.retryNavigation());
    expect(loadMonth).toHaveBeenCalledWith(periods[2]);
    await renderSession({ ...options, months, monthErrors: {} });
    expect(session.navigation).toMatchObject({
      next: months["2026-03"].photos[0],
      status: "ready",
    });
    expect(session.selectedPhoto).toEqual(photo);
  });

  it("coordinates view, selection, URL, and adjacent loading", async () => {
    const loadMonth = vi.fn(async () => undefined);

    await renderSession({
      index,
      months: { "2026-04": months["2026-04"] },
      monthErrors: {},
      loadMonth,
      resolvePhoto: vi.fn().mockResolvedValue(photo),
    });
    await act(async () => session.openTimeline("trip"));
    expect(session.view).toEqual({ mode: "timeline", albumId: "trip" });
    expect(window.location.hash).toBe("#album=trip");

    await act(async () => session.openPhoto(photo));
    expect(session.selectedPhoto).toEqual(photo);
    expect(window.location.hash).toBe(`#album=trip&photo=${photo.id}`);
    expect(loadMonth).toHaveBeenCalledWith(periods[0]);
    expect(loadMonth).toHaveBeenCalledWith(periods[2]);

    await act(async () => session.returnToOverview());
    expect(session.view).toEqual({ mode: "overview" });
    expect(session.selectedPhoto).toBeNull();
    expect(session.displayPhoto).toEqual(photo);
    expect(window.location.hash).toBe("");
  });

  it("removes a missing photo from a direct URL", async () => {
    window.history.replaceState({}, "", `/photos/#photo=${photo.id}`);

    await renderSession({
      index,
      months,
      monthErrors: {},
      loadMonth: vi.fn(async () => undefined),
      resolvePhoto: vi.fn().mockResolvedValue(null),
    });

    expect(session.selectionState).toEqual({ status: "idle" });
    expect(window.location.hash).toBe("");
  });

  it("keeps same-page history in the session while Astro handles cross-page history", async () => {
    window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, "", "/about/");
    window.history.pushState({ index: 1, scrollX: 0, scrollY: 0 }, "", "/photos/");
    const removeRouter = await installAstroRouter();
    const fetchPage = vi.spyOn(window, "fetch").mockImplementation(() => new Promise(() => {}));
    try {
      const options: BrowsingOptions = {
        index,
        months,
        monthErrors: {},
        loadMonth: vi.fn(async () => undefined),
        resolvePhoto: vi.fn().mockResolvedValue(photo),
      };
      await renderSession(options);
      await act(async () => session.openTimeline("trip"));
      await act(async () => session.openPhoto(photo));
      await travel(() => session.closePhoto(), "#album=trip");
      expect(fetchPage).not.toHaveBeenCalled();
      expect(session.selectedPhoto).toBeNull();
      expect(session.view).toEqual({ mode: "timeline", albumId: "trip" });

      await travel(() => history.forward(), `#album=trip&photo=${photo.id}`);
      expect(session.selectedPhoto).toEqual(photo);
      await renderSession({ ...options, index: null });
      await travel(() => history.back(), "#album=trip");
      await renderSession(options);
      expect(session.view).toEqual({ mode: "timeline", albumId: "trip" });
      await travel(() => history.back(), "");
      expect(session.view).toEqual({ mode: "overview" });
      expect(fetchPage).not.toHaveBeenCalled();

      await act(async () => {
        history.back();
        await vi.waitFor(() => expect(window.location.pathname).toBe("/about/"));
      });
      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(fetchPage.mock.calls[0][0]).toBe(`${window.location.origin}/about/`);
      expect(session.view).toEqual({ mode: "overview" });

      await act(async () => root.render(null));
      fetchPage.mockClear();
      window.history.replaceState({ index: 1, scrollX: 0, scrollY: 0 }, "", "/photos/");
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
      expect(fetchPage).toHaveBeenCalledTimes(1);
    } finally {
      removeRouter();
    }
  });
});

async function travel(action: () => void, hash: string) {
  await act(async () => {
    action();
    await vi.waitFor(() => expect(window.location.hash).toBe(hash));
  });
}

async function installAstroRouter(): Promise<() => void> {
  const configuration: BuildConfig = {
    entrypoints: [fileURLToPath(new URL("./transitions/router.js", import.meta.resolve("astro")))],
    target: "browser",
    format: "iife",
    define: { "import.meta.env.SSR": "false", "import.meta.env.DEV": "false" },
    plugins: [
      {
        name: "astro-test-adapter",
        setup(builder) {
          builder.onResolve({ filter: /^virtual:astro:adapter-config\/client$/ }, () => ({
            path: "adapter",
            namespace: "astro-test",
          }));
          builder.onLoad({ filter: /.*/, namespace: "astro-test" }, () => ({
            contents: "export const internalFetchHeaders = new Map();",
            loader: "js",
          }));
        },
      },
    ],
  };
  const compiled = await Bun.build(configuration);
  if (!compiled.success) {
    throw new AggregateError(compiled.logs, "Failed to compile the installed Astro router");
  }
  const enabled = document.createElement("meta");
  enabled.name = "astro-view-transitions-enabled";
  document.head.append(enabled);
  const controller = new AbortController();
  const addListener = window.addEventListener.bind(window);
  const registration = vi
    .spyOn(window, "addEventListener")
    .mockImplementation((type, listener, options) => {
      addListener(type, listener, {
        ...(typeof options === "boolean" ? { capture: options } : options),
        signal: controller.signal,
      });
    });
  try {
    window.eval(await compiled.outputs[0].text());
  } finally {
    registration.mockRestore();
  }
  return () => {
    controller.abort();
    enabled.remove();
  };
}

function monthCatalog(period: PhotoPeriod): PhotoMonthCatalog {
  return {
    schemaVersion: 2,
    month: period.month,
    photos: [
      {
        ...photo,
        id: period.month === "2026-04" ? photo.id : period.month.replace("-", "").padStart(32, "0"),
        capturedAt: `${period.month}-25T21:12:30.244+07:00`,
        albumIds: Object.keys(period.albumCounts),
      },
    ],
  };
}
