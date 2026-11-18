import type { ScoreNote } from "./home-score";
import { localizedHref, type Locale } from "./i18n";

export const TRAVEL_STOPS = [
  { id: "kyoto", km: 1780 },
  { id: "hong-kong", km: 1210 },
  { id: "bangkok", km: 2890 },
  { id: "chongqing", km: 1440 },
  { id: "suzhou", km: 84 },
  { id: "harbin", km: 1680 },
] as const;

export type TravelStopId = (typeof TRAVEL_STOPS)[number]["id"];

export function travelAlbumHref(stopId: TravelStopId, locale: Locale): string {
  return `${localizedHref("/photos/", locale)}#album=${encodeURIComponent(stopId)}`;
}

export const PIANO_SECRET_MOTIF = [77, 76, 74, 72] as const;

/** 记录最近按下的琴键序列，命中 F5→E5→D5→C5 暗号时返回 matched=true。 */
export function pushPianoHistory(
  history: readonly number[],
  midi: number,
): { history: number[]; matched: boolean } {
  const next = [...history, midi].slice(-PIANO_SECRET_MOTIF.length);
  const matched =
    next.length === PIANO_SECRET_MOTIF.length &&
    PIANO_SECRET_MOTIF.every((target, index) => next[index] === target);
  return { history: matched ? [] : next, matched };
}

/** 将主旋律前段以 C5(72) 为轴做音高倒影并折叠到客厅 25 键音域，用于 B 面变奏。 */
export function buildInvertedVariation(notes: readonly ScoreNote[], maxBeat = 32): ScoreNote[] {
  return notes
    .filter((note) => note.hand === "melody" && note.beat < maxBeat)
    .map((note) => {
      let inverted = 144 - note.midi;
      while (inverted < 65) {
        inverted += 12;
      }
      while (inverted > 89) {
        inverted -= 12;
      }
      return {
        ...note,
        midi: inverted,
        velocity: Math.min(0.82, note.velocity * 0.92),
      };
    });
}
