/**
 * 首页唱片机的钢琴曲《沙发上的四季》。
 * 录音由 `bun run music:render` 从这份乐谱渲染，播放时的画面也按它同步；改动乐谱后要重新渲染并上传音频。
 */

type Hand = "melody" | "double" | "left";
type Accompaniment = "arp" | "pulse" | "full" | "coda";

interface ScoreSection {
  id: string;
  lh: Accompaniment;
  gain: number;
  /** 旋律力度的整体偏移 */
  lift: number;
  /** 旋律叠低八度 */
  double?: boolean;
  /** [和弦, 旋律]；同一小节的两个和弦各占两拍，旋律写作 `音名:拍数`，`r` 为休止 */
  bars: readonly (readonly [string, string])[];
}

export interface ScoreNote {
  midi: number;
  hand: Hand;
  beat: number;
  /** 秒 */
  time: number;
  duration: number;
  velocity: number;
}

export interface ScoreChord {
  beat: number;
  /** 和弦内音的音级，0 为 C */
  tones: number[];
}

/** 唱片机播放时逐个派发的旋律音，jam 为访客轻点弹出的音 */
export interface RecordNote {
  midi: number;
  velocity: number;
  duration: number;
  jam: boolean;
}

export interface Song {
  notes: ScoreNote[];
  chords: ScoreChord[];
  totalBeats: number;
  /** 含末尾余音的秒数 */
  duration: number;
  timeOf(beat: number): number;
  beatOf(time: number): number;
}

const BPM = 72;
// 最后两小节从 72 渐慢到 54
const RITARDANDO = { fromBeat: 152, toBpm: 54 };
const TAIL_SECONDS = 4.5;

const sections: readonly ScoreSection[] = [
  {
    id: "intro",
    lh: "arp",
    gain: 0.8,
    lift: -0.14,
    bars: [
      ["Fmaj7", "r:4"],
      ["Am7", "r:2 E6:2"],
      ["Bbmaj7", "r:4"],
      ["C7sus4 C7", "r:2 D6:1 C6:1"],
    ],
  },
  {
    id: "a",
    lh: "arp",
    gain: 1,
    lift: 0,
    bars: [
      ["Fmaj7", "r:1 C5:.5 D5:.5 E5:1.5 C5:.5"],
      ["Am7", "E5:1 D5:.5 C5:.5 A4:2"],
      ["Bbmaj7", "r:.5 Bb4:.5 D5:.5 F5:.5 A5:1.5 G5:.5"],
      ["C7sus4 C", "F5:1 E5:.5 D5:.5 E5:2"],
      ["Dm7", "r:.5 A4:.5 D5:.5 E5:.5 F5:1 E5:.5 D5:.5"],
      ["Am7", "C5:1.5 E5:.5 A4:2"],
      ["Gm7", "Bb4:.5 A4:.5 G4:.5 A4:.5 Bb4:1 D5:1"],
      ["Csus4 C", "G4:1 F4:.5 G4:.5 C5:2"],
    ],
  },
  {
    id: "a2",
    lh: "arp",
    gain: 1,
    lift: 0.03,
    bars: [
      ["Fmaj7", "r:1 C5:.5 D5:.5 E5:1 F5:.5 G5:.5"],
      ["Am7", "A5:1.5 G5:.5 E5:2"],
      ["Bbmaj7", "r:.5 D5:.5 F5:.5 A5:.5 C6:1.5 Bb5:.5"],
      ["C7sus4 C", "A5:.5 G5:.5 F5:1 E5:1 G5:1"],
      ["Dm7", "F5:1.5 E5:.5 D5:1 A4:1"],
      ["Am7", "C5:1 E5:1 G5:1.5 E5:.5"],
      ["Gm7 C7", "F5:1 D5:1 E5:1 G4:.5 Bb4:.5"],
      ["Fmaj7", "A4:1 G4:.5 F4:2.5"],
    ],
  },
  {
    id: "b",
    lh: "pulse",
    gain: 1.05,
    lift: 0.06,
    bars: [
      ["Dm9", "A5:1 F5:.5 E5:.5 D5:1 E5:1"],
      ["Bbmaj7", "F5:1.5 D5:.5 Bb4:1 C5:1"],
      ["F/A", "C5:1 A4:.5 C5:.5 F5:1.5 E5:.5"],
      ["C", "E5:2 D5:1 C5:1"],
      ["Gm7", "D5:.5 F5:.5 Bb5:1 A5:.5 G5:.5 F5:1"],
      ["Am7", "E5:1.5 G5:.5 C6:1 A5:1"],
      ["Bbmaj7", "D6:1.5 C6:.5 A5:1 F5:1"],
      ["C7sus4 C7", "G5:2 F5:1 E5:1"],
    ],
  },
  {
    id: "a3",
    lh: "full",
    gain: 1.12,
    lift: 0.08,
    double: true,
    bars: [
      ["Fmaj7", "r:1 C5:.5 D5:.5 E5:1 F5:.5 G5:.5"],
      ["Am7", "A5:1.5 G5:.5 E5:2"],
      ["Bbmaj7", "r:.5 D5:.5 F5:.5 A5:.5 C6:1.5 Bb5:.5"],
      ["C7sus4 C", "A5:.5 G5:.5 F5:1 E5:1 G5:1"],
      ["Dm7", "F5:1.5 E5:.5 D5:1 A4:1"],
      ["Am7", "C5:1 E5:1 G5:1.5 E5:.5"],
      ["Gm7 C7", "F5:1 D5:1 E5:1 G4:.5 Bb4:.5"],
      ["Dm9", "A4:1 G4:.5 F4:1.5 r:1"],
    ],
  },
  {
    id: "coda",
    lh: "coda",
    gain: 0.85,
    lift: -0.06,
    bars: [
      ["Bbmaj7", "r:1 F5:1 E5:1 D5:1"],
      ["Am7", "C5:2 E5:2"],
      ["Gm7 C7sus4", "D5:1 Bb4:1 C5:2"],
      ["Fmaj9", "F5:4"],
    ],
  },
];

const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY: Record<string, number[]> = {
  "": [0, 4, 7],
  sus4: [0, 5, 7],
  "7": [0, 4, 7, 10],
  "7sus4": [0, 5, 7, 10],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
};
const PATTERNS: Record<Accompaniment, { step: number; whole: number[]; half: number[] }> = {
  arp: { step: 0.5, whole: [0, 1, 2, 3, 4, 3, 2, 1], half: [0, 1, 2, 3] },
  full: { step: 0.5, whole: [0, 1, 2, 3, 4, 3, 2, 1], half: [0, 1, 2, 3] },
  pulse: { step: 0.5, whole: [0, 1, 2, 3, 0, 2, 3, 4], half: [0, 1, 2, 3] },
  coda: { step: 1, whole: [0, 2, 3, 4], half: [0, 3] },
};

const mod12 = (n: number) => ((n % 12) + 12) % 12;

function pitchClass(name: string) {
  return mod12(PITCH[name[0]] + (name[1] === "b" ? -1 : name[1] === "#" ? 1 : 0));
}

function midiOf(note: string) {
  const match = /^([A-G][b#]?)(\d)$/.exec(note);
  if (!match) {
    throw new Error(`无法识别的音名: ${note}`);
  }
  return 12 * (Number(match[2]) + 1) + pitchClass(match[1]);
}

function parseChord(name: string) {
  const [main, slash] = name.split("/");
  const match = /^([A-G][b#]?)(.*)$/.exec(main);
  const intervals = match ? QUALITY[match[2]] : undefined;
  if (!match || !intervals) {
    throw new Error(`无法识别的和弦: ${name}`);
  }
  const root = pitchClass(match[1]);
  // 低音放在 C2–B2，左手的分解和弦不会撞到旋律
  const low = 36 + root;
  const seventh = intervals.find((interval) => interval >= 10 && interval <= 11);
  const voicing = [
    slash ? 36 + pitchClass(slash) : low,
    low + 7,
    low + (seventh ?? 12),
    low + intervals[1] + 12,
    intervals.includes(14) ? low + 26 : low + 19,
  ];
  return { tones: intervals.map((interval) => mod12(root + interval)), voicing };
}

/** 固定种子，让每次渲染的人手误差一致 */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSong(): Song {
  type Draft = Omit<ScoreNote, "time" | "duration"> & { length: number };
  const drafts: Draft[] = [];
  const chords: ScoreChord[] = [];
  let beat = 0;

  for (const section of sections) {
    section.bars.forEach(([chordText, melody], barIndex) => {
      const names = chordText.split(" ");
      const span = 4 / names.length;
      const finale = section.id === "coda" && barIndex === section.bars.length - 1;
      const pattern = PATTERNS[section.lh];
      names.forEach((name, chordIndex) => {
        const start = beat + chordIndex * span;
        const { tones, voicing } = parseChord(name);
        chords.push({ beat: start, tones });
        const base = 0.4 * section.gain;
        // 左手每个音都踩着踏板响到换和弦
        const left = (
          midi: number,
          at: number,
          velocity: number,
          length = start + span - at + 0.2,
        ) => drafts.push({ midi, hand: "left", beat: at, length, velocity });
        if (finale) {
          voicing.forEach((midi, index) => left(midi, start + index * 0.09, base * 1.05, 7));
          return;
        }
        (span === 4 ? pattern.whole : pattern.half).forEach((index, slot) => {
          const at = start + slot * pattern.step;
          left(voicing[index], at, base * (slot === 0 ? 1 : slot % 2 ? 0.66 : 0.78));
          if (section.lh === "full" && slot === 0) {
            left(voicing[0] + 12, at, base * 0.7);
          }
        });
      });

      let at = beat;
      for (const token of melody.split(" ")) {
        const [note, beats] = token.split(":");
        const length = Number(beats);
        if (note !== "r") {
          const strong = Number.isInteger(at) && (at - beat) % 2 === 0;
          const velocity = Math.min(
            0.92,
            0.6 + section.lift + (strong ? 0.06 : 0) + (length >= 1.5 ? 0.05 : 0),
          );
          const midi = midiOf(note);
          drafts.push({
            midi,
            hand: "melody",
            beat: at,
            length: finale ? 7 : length * 1.1,
            velocity,
          });
          if (section.double) {
            drafts.push({
              midi: midi - 12,
              hand: "double",
              beat: at,
              length: length * 1.1,
              velocity: velocity * 0.5,
            });
          }
        }
        at += length;
      }
      if (at - beat !== 4) {
        throw new Error(`第 ${beat / 4 + 1} 小节的旋律是 ${at - beat} 拍`);
      }
      if (finale) {
        drafts.push({
          midi: midiOf("C6"),
          hand: "melody",
          beat: beat + 2,
          length: 5,
          velocity: 0.3,
        });
      }
      beat += 4;
    });
  }

  const totalBeats = beat;
  const bpmAt = (b: number) =>
    b < RITARDANDO.fromBeat
      ? BPM
      : BPM -
        (BPM - RITARDANDO.toBpm) *
          Math.min(1, (b - RITARDANDO.fromBeat) / (totalBeats - RITARDANDO.fromBeat));
  const beatTimes = [0];
  for (let index = 0; index < totalBeats + 16; index++) {
    beatTimes.push(beatTimes[index] + 60 / bpmAt(index + 0.5));
  }
  const timeOf = (b: number) => {
    const index = Math.max(0, Math.min(Math.floor(b), beatTimes.length - 2));
    return beatTimes[index] + (b - index) * (beatTimes[index + 1] - beatTimes[index]);
  };
  const beatOf = (time: number) => {
    let low = 0;
    let high = beatTimes.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (beatTimes[middle] <= time) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return low + (time - beatTimes[low]) / (beatTimes[low + 1] - beatTimes[low]);
  };

  const random = seededRandom(20261025);
  const notes = drafts
    .map(({ length, ...note }) => {
      const jitter = (random() - 0.5) * (note.hand === "left" ? 0.012 : 0.016);
      return {
        ...note,
        time: Math.max(0, timeOf(note.beat) + jitter),
        duration: timeOf(note.beat + length) - timeOf(note.beat),
      };
    })
    .toSorted((a, b) => a.time - b.time);

  return { notes, chords, totalBeats, duration: timeOf(totalBeats) + TAIL_SECONDS, timeOf, beatOf };
}

export const homeSong = buildSong();
