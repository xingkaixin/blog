import { describe, expect, it } from "vitest";
import type { PhotoRecord } from "@/lib/photo-catalog";
import { planPhotoPreload } from "@/lib/photo-preload";

const previous = photo("11111111111111111111111111111111");
const next = photo("22222222222222222222222222222222");

describe("photo lightbox preload", () => {
  it("does not prefetch on data-saving or slow connections", () => {
    expect(planPhotoPreload(previous, next, { saveData: true })).toBeNull();
    expect(planPhotoPreload(previous, next, { effectiveType: "2g" })).toBeNull();
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
