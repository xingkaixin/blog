import { describe, expect, it } from "vitest";
import { computeSkySceneState, resolveSkyPalette } from "./forest-sky-backdrop";

describe("forest-sky-backdrop", () => {
  it("transitions from airy Forest daylight through dusk to deep forest night across scenes", () => {
    const room = computeSkySceneState(0, false, false);
    const hello = computeSkySceneState(1, false, false);
    const pond = computeSkySceneState(2.6, false, false);

    expect(room.nightWeight).toBe(0);
    expect(room.duskWeight).toBe(0);
    expect(hello.duskWeight).toBeGreaterThan(0.8);
    expect(hello.nightWeight).toBe(0);
    expect(pond.nightWeight).toBe(1);
    expect(pond.duskWeight).toBe(0);
  });

  it("forces the night palette in dark theme regardless of scroll position", () => {
    const darkRoom = computeSkySceneState(0, true, false);
    const palette = resolveSkyPalette(darkRoom);

    expect(darkRoom.nightWeight).toBe(1);
    expect(darkRoom.duskWeight).toBe(0);
    expect(palette[0][0]).toBeLessThan(20);
  });

  it("shifts the text-protection dim zone to follow each scene's copy column on desktop", () => {
    const room = computeSkySceneState(0, false, false);
    const hello = computeSkySceneState(1, false, false);
    const credits = computeSkySceneState(2, false, false);
    const pond = computeSkySceneState(3, false, false);

    expect(room.dimCenter[0]).toBeLessThan(0.3);
    expect(hello.dimCenter[0]).toBeGreaterThan(0.6);
    expect(credits.dimCenter[0]).toBeLessThan(0.3);
    expect(pond.dimCenter[1]).toBeLessThan(0.3);
  });

  it("keeps the brightest day step aligned with the light Forest paper tone", () => {
    const dayPalette = resolveSkyPalette({ duskWeight: 0, nightWeight: 0 });
    expect(dayPalette[4]).toEqual([248, 250, 249]);
  });
});
