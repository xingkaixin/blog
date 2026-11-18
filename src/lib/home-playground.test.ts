import { describe, expect, it } from "vitest";
import {
  buildInvertedVariation,
  PIANO_SECRET_MOTIF,
  pushPianoHistory,
  travelAlbumHref,
} from "./home-playground";
import { homeSong } from "./home-score";

describe("home-playground", () => {
  it("builds localized darkroom album links for travel stops", () => {
    expect(travelAlbumHref("kyoto", "zh")).toBe("/photos/#album=kyoto");
    expect(travelAlbumHref("hong-kong", "en")).toBe("/en/photos/#album=hong-kong");
  });

  it("matches the secret reverse motif and resets history after unlocking", () => {
    let state: number[] = [];
    for (const note of [65, ...PIANO_SECRET_MOTIF.slice(0, -1)]) {
      const result = pushPianoHistory(state, note);
      expect(result.matched).toBe(false);
      state = result.history;
    }

    const unlocked = pushPianoHistory(state, PIANO_SECRET_MOTIF.at(-1)!);
    expect(unlocked.matched).toBe(true);
    expect(unlocked.history).toEqual([]);
  });

  it("builds an inverted B-side melody constrained to the 25-key F4–F6 range", () => {
    const variation = buildInvertedVariation(homeSong.notes);
    expect(variation.length).toBeGreaterThan(8);
    for (const note of variation) {
      expect(note.midi).toBeGreaterThanOrEqual(65);
      expect(note.midi).toBeLessThanOrEqual(89);
    }
  });
});
