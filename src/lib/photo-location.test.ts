import { describe, expect, it } from "vitest";
import type { PhotoCatalogIndex } from "@/lib/photo-catalog";
import {
  overviewLocationHref,
  planPhotoClose,
  planPhotoOpen,
  planPhotoSelection,
  planTimelineOpen,
  planTimelineSelection,
  photoLocationHref,
  readPhotoLocation,
  timelineLocationHref,
} from "@/lib/photo-location";

const photoId = "0123456789abcdef0123456789abcdef";
const index: PhotoCatalogIndex = {
  schemaVersion: 3,
  generatedAt: "2026-08-07T12:00:00.000Z",
  albums: [{ id: "trip", title: "旅行" }],
  periods: [
    {
      month: "2026-04",
      count: 1,
      albumCounts: { trip: 1 },
      path: "catalog/months/2026-04.0123456789abcdef01234567.json",
    },
  ],
  photoMonths: { [photoId]: "2026-04" },
};

describe("photo location", () => {
  it("normalizes legacy and invalid photo wall URLs", () => {
    const location = readPhotoLocation(
      `https://example.com/photos/?album=trip#photo=${photoId}`,
      index,
    );
    expect(location).toEqual({
      href: `https://example.com/photos/#photo=${photoId}&album=trip`,
      photoId,
      view: { mode: "timeline", albumId: "trip" },
    });
    expect(timelineLocationHref(location.href, null)).toBe("https://example.com/photos/#album=");
    expect(photoLocationHref(location.href, null)).toBe("https://example.com/photos/#album=trip");
    expect(overviewLocationHref(location.href)).toBe("https://example.com/photos/");
    expect(readPhotoLocation("https://example.com/photos/#album=missing&photo=bad", index)).toEqual(
      {
        href: "https://example.com/photos/#album=",
        photoId: null,
        view: { mode: "timeline", albumId: null },
      },
    );
  });

  it("keeps pushed lightboxes separate from direct photo links", () => {
    const opened = planPhotoOpen(
      "https://example.com/photos/#album=trip",
      { position: 3 },
      photoId,
    );
    expect(opened).toEqual({
      history: "push",
      href: `https://example.com/photos/#album=trip&photo=${photoId}`,
      state: {
        position: 3,
        photoWall: { kind: "lightbox", photoId },
      },
    });
    expect(planPhotoClose(opened.href, opened.state)).toEqual({
      history: "back",
    });
    const directSelection = planPhotoSelection(
      `https://example.com/photos/#photo=${photoId}`,
      null,
      "ffffffffffffffffffffffffffffffff",
    );
    expect(directSelection.state).toEqual({});
    expect(planPhotoClose(directSelection.href, directSelection.state)).toEqual({
      history: "replace",
      href: "https://example.com/photos/",
      state: {},
    });
    expect(planTimelineOpen(opened.href, opened.state, null)).toEqual({
      history: "push",
      href: "https://example.com/photos/#album=",
      state: { position: 3 },
    });
    expect(planTimelineSelection(opened.href, opened.state, "trip")).toEqual({
      history: "replace",
      href: "https://example.com/photos/#album=trip",
      state: { position: 3 },
    });
  });
});
