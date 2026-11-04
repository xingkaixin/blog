import { describe, expect, it } from "vitest";
import { buildJustifiedRows } from "@/lib/photo-layout";

const photos = [
  { id: "landscape", width: 1600, height: 900 },
  { id: "portrait", width: 900, height: 1600 },
  { id: "square", width: 1200, height: 1200 },
  { id: "wide", width: 2000, height: 1000 },
];

describe("buildJustifiedRows", () => {
  it("preserves chronological input order", () => {
    const rows = buildJustifiedRows(photos, {
      containerWidth: 1200,
      targetRowHeight: 260,
      gap: 4,
    });

    expect(rows.flatMap((row) => row.items.map((item) => item.photo.id))).toEqual(
      photos.map((photo) => photo.id),
    );
  });
});
