// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoCatalogIndex, PhotoPeriod, PhotoRecord } from "@/lib/photo-catalog";
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
const index: PhotoCatalogIndex = {
  schemaVersion: 3,
  generatedAt: "2026-08-07T12:00:00.000Z",
  albums: [{ id: "trip", title: "旅行" }],
  periods,
  photoMonths: { [photo.id]: "2026-04" },
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
  it("coordinates view, selection, URL, and adjacent loading", async () => {
    const loadMonth = vi.fn(async () => undefined);

    await renderSession({ index, loadMonth, resolvePhoto: vi.fn().mockResolvedValue(photo) });
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
      loadMonth: vi.fn(async () => undefined),
      resolvePhoto: vi.fn().mockResolvedValue(null),
    });

    expect(session.selectionState).toEqual({ status: "idle" });
    expect(window.location.hash).toBe("");
  });
});
