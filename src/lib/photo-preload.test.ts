import { describe, expect, it } from "vitest";
import type { PhotoRecord } from "@/lib/photo-catalog";
import { photoFromArrow, photoFromSwipe, planPhotoPreload } from "@/lib/photo-preload";

const previous = photo("11111111111111111111111111111111");
const next = photo("22222222222222222222222222222222");

describe("photo lightbox preload", () => {
  it("prefetches one neighbor, preferring the forward one", () => {
    expect(planPhotoPreload(previous, next, undefined)).toBe(next);
    expect(planPhotoPreload(previous, undefined, undefined)).toBe(previous);
    expect(planPhotoPreload(undefined, undefined, undefined)).toBeNull();
  });

  it("does not prefetch on data-saving or slow connections", () => {
    expect(planPhotoPreload(previous, next, { saveData: true })).toBeNull();
    expect(planPhotoPreload(previous, next, { effectiveType: "2g" })).toBeNull();
  });

  it("selects neighbors for keyboard and horizontal swipe navigation", () => {
    expect(photoFromArrow("ArrowLeft", previous, next)).toBe(previous);
    expect(photoFromArrow("ArrowRight", previous, next)).toBe(next);
    expect(photoFromArrow("Escape", previous, next)).toBeUndefined();
    expect(photoFromSwipe(60, 10, previous, next)).toBe(previous);
    expect(photoFromSwipe(-60, 10, previous, next)).toBe(next);
    expect(photoFromSwipe(60, 80, previous, next)).toBeUndefined();
    expect(photoFromSwipe(47, 0, previous, next)).toBeUndefined();
  });
});

function photo(id: string): PhotoRecord {
  return {
    id,
    capturedAt: "2026-04-25T21:12:30.244+07:00",
    width: 3024,
    height: 4032,
    albumIds: [],
    placeholderColor: "#4f5f6a",
  };
}
