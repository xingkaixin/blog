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

  it("fills every completed row without overflowing", () => {
    const rows = buildJustifiedRows(photos, {
      containerWidth: 900,
      targetRowHeight: 220,
      gap: 4,
    });

    for (const row of rows.filter((candidate) => candidate.justified)) {
      const width =
        row.items.reduce((sum, item) => sum + item.width, 0) +
        Math.max(0, row.items.length - 1) * 4;
      expect(width).toBeCloseTo(900, 6);
    }
  });

  it("keeps the final row at or below the target height", () => {
    const rows = buildJustifiedRows(photos.slice(0, 2), {
      containerWidth: 1400,
      targetRowHeight: 280,
      gap: 4,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.justified).toBe(false);
    expect(rows[0]?.height).toBeLessThanOrEqual(280);
  });

  it("returns no rows for a container that has not been measured", () => {
    expect(
      buildJustifiedRows(photos, {
        containerWidth: 0,
        targetRowHeight: 240,
        gap: 4,
      }),
    ).toEqual([]);
  });
});
