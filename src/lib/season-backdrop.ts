/**
 * 首页季节背景：一块 Canvas 2D，叠在夜幕之上、文字与人物之下。
 * 粒子位置由时间直接算出、不累积状态，所以暂停、静止帧和尺寸变化都只需重画一帧。
 */

import type { Season } from "./season";

export interface SeasonBackdrop {
  /** 0 为白天的客厅，1 为片尾与池塘的夜色，跟随首页夜幕的淡入进度。 */
  setNight(amount: number): void;
  setPaused(paused: boolean): void;
  /** 从 (x, y) 抛出一枚当季粒子；lift 与 weight 取 0–1，分别决定抛多高、粒子多大 */
  emit(x: number, y: number, lift: number, weight: number): void;
  /** 以 (x, y) 为圆心荡开一圈淡波纹 */
  ripple(x: number, y: number, from: number, to: number): void;
  destroy(): void;
}

type Range = readonly [number, number];
type Rgb = readonly [number, number, number];
type ShapeKind = "petal" | "ginkgo" | "plane";
type FallerKind = ShapeKind | "snow";

const colorKeys = [
  "petal",
  "petalLight",
  "ginkgo",
  "ginkgoVein",
  "plane",
  "planeVein",
  "snow",
  "mote",
] as const;
type ColorKey = (typeof colorKeys)[number];
type Palette = Record<ColorKey, Rgb> & { snowEdge: number };
type Colors = Record<ColorKey, string> & { snowEdge: number };

const lightDay: Palette = {
  petal: [242, 179, 194],
  petalLight: [253, 228, 234],
  ginkgo: [227, 173, 52],
  ginkgoVein: [245, 208, 106],
  plane: [196, 120, 54],
  planeVein: [224, 157, 88],
  snow: [255, 255, 255],
  mote: [217, 173, 69],
  // 白雪落在浅色墙面上要靠冷灰阴影才看得见；1 为全用阴影，0 为全用微光
  snowEdge: 1,
};
const darkDay: Palette = {
  ...lightDay,
  petal: [212, 142, 160],
  petalLight: [239, 192, 203],
  snow: [242, 246, 249],
  mote: [233, 201, 119],
  snowEdge: 0,
};
const nightPalette: Palette = {
  ...darkDay,
  petal: [201, 134, 153],
  petalLight: [232, 182, 194],
  ginkgo: [207, 156, 51],
  ginkgoVein: [230, 191, 92],
  plane: [173, 106, 49],
  planeVein: [201, 138, 76],
};

interface FallSpec {
  count: number;
  kinds: readonly FallerKind[];
  /** 从顶端落到底端的秒数 */
  fall: Range;
  /** 一趟下落的横向漂移 */
  drift: number;
  sway: Range;
  swayPeriod: Range;
  spin?: Range;
  size: Range;
  alpha: Range;
}

const fallSpecs: Partial<Record<Season, FallSpec[]>> = {
  spring: [
    {
      count: 22,
      kinds: ["petal"],
      fall: [13, 23],
      drift: 140,
      sway: [16, 44],
      swayPeriod: [5.2, 10],
      spin: [2.4, 5.4],
      size: [11, 19],
      alpha: [0.62, 0.95],
    },
  ],
  autumn: [
    {
      count: 14,
      kinds: ["ginkgo", "ginkgo", "ginkgo", "plane", "plane"],
      fall: [10, 16],
      drift: 90,
      sway: [28, 60],
      swayPeriod: [4.4, 7.6],
      spin: [3, 6],
      size: [20, 32],
      alpha: [0.82, 1],
    },
  ],
  winter: [
    {
      count: 34,
      kinds: ["snow"],
      fall: [20, 28],
      drift: 36,
      sway: [4, 6],
      swayPeriod: [6, 10],
      size: [2.4, 3.6],
      alpha: [0.55, 0.75],
    },
    {
      count: 20,
      kinds: ["snow"],
      fall: [13, 19],
      drift: 36,
      sway: [6, 16],
      swayPeriod: [5.2, 8.8],
      size: [4, 6],
      alpha: [0.7, 0.9],
    },
    {
      count: 8,
      kinds: ["snow"],
      fall: [9, 13],
      drift: 36,
      sway: [16, 28],
      swayPeriod: [4.8, 7.2],
      size: [7, 10],
      alpha: [0.8, 0.95],
    },
  ],
};

/** 地板上的落瓣与落叶：[横向占宽比, 地板内纵向占比, 角度, 尺寸, 形状] */
const groundPieces: Partial<
  Record<Season, readonly (readonly [number, number, number, number, ShapeKind])[]>
> = {
  spring: [
    [0.1, 0.33, -64, 14, "petal"],
    [0.37, 0.56, 38, 12, "petal"],
    [0.93, 0.22, 112, 13, "petal"],
    [0.96, 0.66, -18, 11, "petal"],
  ],
  autumn: [
    [0.12, 0.2, -32, 28, "ginkgo"],
    [0.34, 0.5, 24, 30, "plane"],
    [0.92, 0.16, 140, 24, "ginkgo"],
    [0.955, 0.6, -70, 22, "ginkgo"],
  ],
};

const shapePaths: Record<ShapeKind, { box: number; body: string; vein: string; stem?: string }> = {
  petal: {
    box: 20,
    body: "M10 23.5C4.6 20.4 1.2 15.6 1.6 10 2 5.2 4.6 1.6 7.4 1.9 8.6 2 9.4 3 10 4.4 10.6 3 11.4 2 12.6 1.9 15.4 1.6 18 5.2 18.4 10 18.8 15.6 15.4 20.4 10 23.5Z",
    vein: "M10 21C7 18.6 5.2 15.2 5.5 11.4 5.8 8.4 7.6 6.8 10 8.8Z",
  },
  ginkgo: {
    box: 32,
    body: "M16 20C10.5 20 3.6 14.4 2.6 7.6 2.3 5.6 3.6 4.4 5.6 4.6 9 4.9 12.6 5.2 14.6 4.4L16 9 17.4 4.4C19.4 5.2 23 4.9 26.4 4.6 28.4 4.4 29.7 5.6 29.4 7.6 28.4 14.4 21.5 20 16 20Z",
    vein: "M16 19 8 7.4M16 19 12.2 6.2M16 19 19.8 6.2M16 19 24 7.4",
    stem: "M16 20V30",
  },
  plane: {
    box: 32,
    body: "M16 2 18.4 8.6 24 5.4 22.6 11.6 29.6 11.4 24.8 16.4 28.4 20.8 21.4 20.6 18 25 16 22.4 14 25 10.6 20.6 3.6 20.8 7.2 16.4 2.4 11.4 9.4 11.6 8 5.4 13.6 8.6Z",
    vein: "M16 22V6M16 18 25 12M16 18 7 12",
    stem: "M16 22.4V31",
  },
};

/** 夏日窗外树影，坐标取自设计稿 660×440 的取景框：[叶柄 x, 叶柄 y, 角度, 半长] */
const canopyLeaves = [
  [40, 55, -140, 28],
  [70, 58, 40, 28],
  [110, 50, -120, 30],
  [150, 56, 60, 28],
  [190, 60, -150, 32],
  [230, 68, 30, 28],
  [270, 74, -110, 30],
  [310, 74, 70, 28],
  [350, 72, -160, 30],
  [390, 70, 20, 32],
  [430, 74, -120, 28],
  [470, 82, 50, 30],
  [520, 92, -140, 28],
  [560, 104, 35, 30],
  [600, 108, -100, 28],
  [165, 100, -170, 28],
  [180, 120, 10, 30],
  [205, 160, -160, 28],
  [220, 180, 20, 30],
  [250, 215, -150, 28],
  [270, 235, 30, 30],
  [295, 250, 80, 26],
  [330, 130, 120, 28],
  [360, 150, -40, 30],
  [90, 110, 150, 28],
  [60, 130, -30, 30],
] as const;
/** 深色主题下树影看不见，改画透过枝叶的光斑：[x, y, 半径] */
const canopySpots = [
  [120, 150, 26],
  [240, 110, 38],
  [330, 210, 22],
  [420, 140, 30],
  [520, 180, 18],
  [180, 260, 34],
  [60, 240, 16],
  [400, 290, 24],
] as const;
const canopyBranches = [
  ["M-20 60C120 40 260 90 420 70S600 120 660 100", 7],
  ["M140 52C200 130 230 200 300 250", 4],
] as const;
const CANOPY_W = 660;
const CANOPY_H = 440;
const CANOPY_PAD = 24;

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const MAX_DPR = 2;
const NARROW_WIDTH = 768;
const FLOOR_SHARE = 0.15;

interface Faller {
  kind: FallerKind;
  x: number;
  size: number;
  alpha: number;
  fall: number;
  phase: number;
  sway: number;
  swayPeriod: number;
  swayPhase: number;
  spin: number;
  spinPhase: number;
}

interface FallLayer {
  drift: number;
  items: Faller[];
}

interface Drifter {
  x: number;
  y: number;
  size: number;
  period: number;
  phase: number;
  blink: number;
  blinkPhase: number;
}

interface Flyer {
  kind: FallerKind | "mote";
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  fall: number;
  sway: number;
  swayPhase: number;
  spin: number;
  spinPhase: number;
}

interface Ripple {
  x: number;
  y: number;
  from: number;
  to: number;
  age: number;
}

/** 音符粒子：沿用各季的形状，夏天是光点；尺寸按力度在区间里取 */
const flyerSpecs: Record<Season, { kinds: readonly Flyer["kind"][]; size: Range; fall: number }> = {
  spring: { kinds: ["petal"], size: [10, 17], fall: 30 },
  summer: { kinds: ["mote"], size: [3, 6], fall: -8 },
  autumn: { kinds: ["ginkgo", "ginkgo", "plane"], size: [16, 26], fall: 34 },
  winter: { kinds: ["snow"], size: [4, 8], fall: 24 },
};
const FLYER_LIFE = 9;
const FLYER_LIMIT = 80;
const RIPPLE_LIFE = 1.4;

const between = ([min, max]: Range) => min + Math.random() * (max - min);

function createLayer(spec: FallSpec): FallLayer {
  return {
    drift: spec.drift,
    items: Array.from({ length: spec.count }, () => ({
      kind: spec.kinds[Math.floor(Math.random() * spec.kinds.length)],
      x: between([-0.06, 0.98]),
      size: between(spec.size),
      alpha: between(spec.alpha),
      fall: between(spec.fall),
      phase: Math.random(),
      sway: between(spec.sway),
      swayPeriod: between(spec.swayPeriod),
      swayPhase: Math.random() * TAU,
      spin: spec.spin ? between(spec.spin) : 1,
      spinPhase: Math.random() * TAU,
    })),
  };
}

function createDrifters(count: number, x: Range, y: Range, size: Range, period: Range): Drifter[] {
  return Array.from({ length: count }, () => ({
    x: between(x),
    y: between(y),
    size: between(size),
    period: between(period),
    phase: Math.random(),
    blink: between([2.2, 4.4]),
    blinkPhase: Math.random() * TAU,
  }));
}

function mixPalette(day: Palette, night: number): Colors {
  const colors = { snowEdge: day.snowEdge * (1 - night) } as Colors;
  for (const key of colorKeys) {
    const [r, g, b] = day[key].map((value, index) =>
      Math.round(value + (nightPalette[key][index] - value) * night),
    );
    colors[key] = `rgb(${r} ${g} ${b})`;
  }
  return colors;
}

function paintCanopyLayer(layer: number, dark: boolean, ratio: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((CANOPY_W + CANOPY_PAD * 2) * ratio);
  canvas.height = Math.ceil((CANOPY_H + CANOPY_PAD * 2) * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.filter = `blur(${5 * ratio}px)`;
  ctx.setTransform(ratio, 0, 0, ratio, CANOPY_PAD * ratio, CANOPY_PAD * ratio);
  if (dark) {
    ctx.fillStyle = "rgb(255 214 150 / 0.08)";
    canopySpots.forEach(([x, y, r], index) => {
      if (index % 2 === layer) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    });
    return canvas;
  }
  ctx.fillStyle = ctx.strokeStyle = "rgb(44 66 50 / 0.13)";
  if (layer === 0) {
    ctx.lineCap = "round";
    for (const [d, lineWidth] of canopyBranches) {
      ctx.lineWidth = lineWidth;
      ctx.stroke(new Path2D(d));
    }
  }
  canopyLeaves.forEach(([x, y, degrees, length], index) => {
    if (index % 2 === layer) {
      const angle = degrees * RAD;
      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length,
        length,
        length * 0.36,
        angle,
        0,
        TAU,
      );
      ctx.fill();
    }
  });
  return canvas;
}

/** 雪花贴图：半径 12 的白色圆盘放在 48×48 中央，四周留给阴影或微光 */
function paintFlake(edge: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.shadowColor = edge ? "rgb(70 98 122 / 0.55)" : "rgb(255 255 255 / 0.7)";
    ctx.shadowBlur = edge ? 4 : 10;
    if (edge) {
      const rim = ctx.createRadialGradient(24, 24, 0, 24, 24, 12);
      rim.addColorStop(0.5, "rgb(255 255 255)");
      rim.addColorStop(1, "rgb(160 180 196)");
      ctx.fillStyle = rim;
    } else {
      ctx.fillStyle = "rgb(255 255 255)";
    }
    ctx.beginPath();
    ctx.arc(24, 24, 12, 0, TAU);
    ctx.fill();
  }
  return canvas;
}

function paintGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgb(241 247 166 / 0.95)");
    gradient.addColorStop(0.18, "rgb(214 240 110 / 0.55)");
    gradient.addColorStop(0.5, "rgb(206 236 96 / 0.14)");
    gradient.addColorStop(1, "rgb(206 236 96 / 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  return canvas;
}

export function createSeasonBackdrop(
  canvas: HTMLCanvasElement,
  season: Season,
  initiallyPaused: boolean,
): SeasonBackdrop | null {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const ctx = context;
  const shapes = Object.fromEntries(
    Object.entries(shapePaths).map(([kind, path]) => [
      kind,
      {
        box: path.box,
        body: new Path2D(path.body),
        vein: new Path2D(path.vein),
        stem: path.stem ? new Path2D(path.stem) : null,
      },
    ]),
  ) as Record<ShapeKind, { box: number; body: Path2D; vein: Path2D; stem: Path2D | null }>;
  const layers = (fallSpecs[season] ?? []).map(createLayer);
  const summer = season === "summer";
  const motes = summer ? createDrifters(10, [0.04, 0.56], [0.16, 0.78], [2.5, 4.5], [14, 22]) : [];
  const fireflies = summer ? createDrifters(16, [0.03, 0.97], [0.3, 0.92], [4, 6], [9, 15]) : [];
  const glow = summer ? paintGlow() : null;
  const flakes = season === "winter" ? { edge: paintFlake(true), glow: paintFlake(false) } : null;
  const root = document.documentElement;
  const events = new AbortController();

  let width = 0;
  let height = 0;
  let dpr = 1;
  let canopyScale = 1;
  let canopy: HTMLCanvasElement[] = [];
  let dark = root.dataset.theme === "dark";
  let night = 0;
  let paused = initiallyPaused;
  let visible = true;
  let elapsed = 0;
  let last = 0;
  let frame = 0;
  const flyers: Flyer[] = [];
  const ripples: Ripple[] = [];

  function drawShape(
    kind: ShapeKind,
    x: number,
    y: number,
    angle: number,
    scaleX: number,
    scaleY: number,
    colors: Colors,
  ) {
    const shape = shapes[kind];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scaleX / shape.box, scaleY / shape.box);
    ctx.translate(-shape.box / 2, -shape.box / 2);
    if (kind === "petal") {
      ctx.fillStyle = colors.petal;
      ctx.fill(shape.body);
      // 只有正面朝外时才露出浅色的瓣心
      if (scaleX > 0) {
        ctx.fillStyle = colors.petalLight;
        ctx.fill(shape.vein);
      }
    } else {
      const base = kind === "ginkgo" ? colors.ginkgo : colors.plane;
      ctx.fillStyle = ctx.strokeStyle = base;
      ctx.fill(shape.body);
      ctx.lineCap = "round";
      ctx.lineWidth = 1.4;
      ctx.stroke(shape.stem!);
      ctx.strokeStyle = kind === "ginkgo" ? colors.ginkgoVein : colors.planeVein;
      ctx.lineWidth = 0.7;
      ctx.stroke(shape.vein);
    }
    ctx.restore();
  }

  function drawGround(colors: Colors) {
    const floorTop = height * (1 - FLOOR_SHARE);
    ctx.globalAlpha = 1 - night;
    for (const [x, y, degrees, size, kind] of groundPieces[season] ?? []) {
      drawShape(
        kind,
        x * width,
        floorTop + y * height * FLOOR_SHARE,
        degrees * RAD,
        size,
        size * 0.55,
        colors,
      );
    }
    if (season !== "winter") {
      return;
    }
    const traceDrift = () => {
      for (let x = 0, step = 0; x < width; x += 80, step++) {
        ctx.quadraticCurveTo(
          x + 40,
          floorTop - 7 + (step % 3),
          x + 80,
          floorTop - 2 - (step % 2) * 2,
        );
      }
    };
    ctx.beginPath();
    ctx.moveTo(0, floorTop + 3);
    ctx.lineTo(0, floorTop - 2);
    traceDrift();
    ctx.lineTo(width, floorTop + 3);
    ctx.closePath();
    ctx.save();
    ctx.shadowColor = `rgb(84 112 136 / ${colors.snowEdge * 0.5})`;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = colors.snow;
    ctx.fill();
    ctx.restore();
    if (colors.snowEdge > 0) {
      ctx.beginPath();
      ctx.moveTo(0, floorTop - 2);
      traceDrift();
      ctx.strokeStyle = `rgb(160 180 196 / ${colors.snowEdge * 0.7})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawFallers(colors: Colors, share: number) {
    for (const layer of layers) {
      const count = Math.ceil(layer.items.length * share);
      for (let index = 0; index < count; index++) {
        const item = layer.items[index];
        const progress = (elapsed / item.fall + item.phase) % 1;
        const margin = item.size * 2 + 20;
        const x =
          item.x * width +
          layer.drift * progress +
          item.sway * Math.sin((TAU * elapsed) / item.swayPeriod + item.swayPhase);
        const y = -margin + progress * (height + margin * 2);
        if (item.kind === "snow") {
          if (flakes) {
            const reach = item.size;
            ctx.globalAlpha = item.alpha * colors.snowEdge;
            ctx.drawImage(flakes.edge, x - reach, y - reach, reach * 2, reach * 2);
            ctx.globalAlpha = item.alpha * (1 - colors.snowEdge);
            ctx.drawImage(flakes.glow, x - reach, y - reach, reach * 2, reach * 2);
          }
          continue;
        }
        ctx.globalAlpha = item.alpha;
        const turn = (TAU * elapsed) / item.spin + item.spinPhase;
        // 翻到侧面时不压成零宽，避免叶片整片消失
        const flip = Math.cos(turn);
        const facing = Math.abs(flip) < 0.08 ? Math.sign(flip || 1) * 0.08 : flip;
        const angle = item.kind === "petal" ? item.spinPhase + turn * 0.4 : turn;
        drawShape(item.kind, x, y, angle, item.size * facing, item.size, colors);
      }
    }
  }

  function drawSummer(colors: Colors, share: number) {
    const day = 1 - night;
    if (day > 0) {
      canopy.forEach((layer, index) => {
        const swing =
          Math.sin((TAU * elapsed) / (index ? 7.4 : 18) + index) * (index ? 0.018 : 0.026);
        const breathe = dark
          ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((TAU * elapsed) / (index ? 7.2 : 10) + index * 2))
          : 1;
        ctx.save();
        ctx.globalAlpha = day * breathe;
        ctx.translate(-40 * canopyScale, -30 * canopyScale);
        ctx.rotate(swing);
        ctx.drawImage(
          layer,
          -CANOPY_PAD * canopyScale,
          -CANOPY_PAD * canopyScale,
          layer.width / dpr,
          layer.height / dpr,
        );
        ctx.restore();
      });
      ctx.fillStyle = colors.mote;
      for (let index = 0; index < Math.ceil(motes.length * share); index++) {
        const mote = motes[index];
        const progress = (elapsed / mote.period + mote.phase) % 1;
        ctx.globalAlpha = day * Math.sin(Math.PI * progress) * 0.7;
        ctx.beginPath();
        ctx.arc(
          mote.x * width - 36 * progress,
          mote.y * height - 110 * progress,
          mote.size / 2,
          0,
          TAU,
        );
        ctx.fill();
      }
    }
    if (night > 0 && glow) {
      ctx.fillStyle = "rgb(241 247 166)";
      for (let index = 0; index < Math.ceil(fireflies.length * share); index++) {
        const fly = fireflies[index];
        const turn = (TAU * elapsed) / fly.period + fly.phase * TAU;
        const x = fly.x * width + Math.sin(turn) * 40 + Math.sin(turn * 1.75 + fly.phase) * 14;
        const y = fly.y * height + Math.cos(turn * 0.77) * 28;
        const pulse = (0.5 + 0.5 * Math.sin((TAU * elapsed) / fly.blink + fly.blinkPhase)) ** 3;
        const radius = fly.size * 3.5;
        ctx.globalAlpha = night * (0.12 + 0.88 * pulse);
        ctx.drawImage(glow, x - radius, y - radius, radius * 2, radius * 2);
        ctx.beginPath();
        ctx.arc(x, y, fly.size * 0.3, 0, TAU);
        ctx.fill();
      }
    }
  }

  function stepFlyers(dt: number) {
    for (let index = flyers.length - 1; index >= 0; index--) {
      const flyer = flyers[index];
      flyer.age += dt;
      // 先被抛起，减速后并入背景里的下落节奏
      flyer.vy = Math.min(flyer.vy + 160 * dt, flyer.fall);
      flyer.vx *= 1 - 0.9 * dt;
      flyer.x += flyer.vx * dt + Math.sin(flyer.age * 1.3 + flyer.swayPhase) * flyer.sway * dt;
      flyer.y += flyer.vy * dt;
      if (flyer.age > FLYER_LIFE || flyer.y > height + 40 || flyer.x > width + 40) {
        flyers.splice(index, 1);
      }
    }
    for (let index = ripples.length - 1; index >= 0; index--) {
      ripples[index].age += dt;
      if (ripples[index].age > RIPPLE_LIFE) {
        ripples.splice(index, 1);
      }
    }
  }

  function drawFlyers(colors: Colors) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = dark || night > 0.5 ? "rgb(236 239 237)" : "rgb(23 26 25)";
    for (const ripple of ripples) {
      const progress = ripple.age / RIPPLE_LIFE;
      ctx.globalAlpha = 0.18 * (1 - progress);
      ctx.beginPath();
      ctx.arc(
        ripple.x,
        ripple.y,
        ripple.from + (ripple.to - ripple.from) * (1 - (1 - progress) ** 3),
        0,
        TAU,
      );
      ctx.stroke();
    }
    for (const flyer of flyers) {
      const fade = Math.min(1, flyer.age / 0.12) * Math.min(1, (FLYER_LIFE - flyer.age) / 1.5);
      const { kind, x, y, size } = flyer;
      if (kind === "mote") {
        if (night > 0 && glow) {
          const radius = size * 3.5;
          ctx.globalAlpha = fade * night;
          ctx.drawImage(glow, x - radius, y - radius, radius * 2, radius * 2);
        }
        ctx.globalAlpha = fade * 0.85;
        ctx.fillStyle = colors.mote;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, TAU);
        ctx.fill();
      } else if (kind === "snow") {
        if (flakes) {
          ctx.globalAlpha = fade * colors.snowEdge;
          ctx.drawImage(flakes.edge, x - size, y - size, size * 2, size * 2);
          ctx.globalAlpha = fade * (1 - colors.snowEdge);
          ctx.drawImage(flakes.glow, x - size, y - size, size * 2, size * 2);
        }
      } else {
        ctx.globalAlpha = fade;
        const turn = (TAU * flyer.age) / flyer.spin + flyer.spinPhase;
        const flip = Math.cos(turn);
        const facing = Math.abs(flip) < 0.08 ? Math.sign(flip || 1) * 0.08 : flip;
        drawShape(
          kind,
          x,
          y,
          kind === "petal" ? flyer.spinPhase + turn * 0.4 : turn,
          size * facing,
          size,
          colors,
        );
      }
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    if (width === 0 || height === 0) {
      return;
    }
    const colors = mixPalette(dark ? darkDay : lightDay, night);
    const share = width < NARROW_WIDTH ? 0.5 : 1;
    if (night < 1) {
      drawGround(colors);
    }
    drawFallers(colors, share);
    if (summer) {
      drawSummer(colors, share);
    }
    drawFlyers(colors);
    ctx.globalAlpha = 1;
  }

  function tick(now: number) {
    // 切回标签页时不让粒子一次跳过整段时间
    const dt = Math.min(0.1, (now - last) / 1000);
    elapsed += dt;
    last = now;
    stepFlyers(dt);
    draw();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    const running = !paused && visible && !document.hidden;
    if (running && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (!running && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function repaintCanopy() {
    if (summer) {
      canopy = [0, 1].map((layer) => paintCanopyLayer(layer, dark, canopyScale * dpr));
    }
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canopyScale = Math.min(1.2, Math.max(0.55, width / 1280));
    repaintCanopy();
    draw();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const visibility = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    sync();
  });
  visibility.observe(canvas);
  const themeObserver = new MutationObserver(() => {
    dark = root.dataset.theme === "dark";
    repaintCanopy();
    if (!frame) {
      draw();
    }
  });
  themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("visibilitychange", sync, { signal: events.signal });
  resize();
  sync();

  return {
    setNight(amount) {
      if (amount === night) {
        return;
      }
      night = amount;
      if (!frame) {
        draw();
      }
    },
    setPaused(next) {
      paused = next;
      sync();
    },
    emit(x, y, lift, weight) {
      // 动画停着时不攒粒子，免得恢复时一下涌出来
      if (!frame || flyers.length >= FLYER_LIMIT) {
        return;
      }
      const spec = flyerSpecs[season];
      flyers.push({
        kind: spec.kinds[Math.floor(Math.random() * spec.kinds.length)],
        x,
        y,
        vx: between([40, 90]) + lift * width * 0.12,
        vy: -(110 + lift * Math.min(300, height * 0.6)) * between([0.9, 1.1]),
        size: spec.size[0] + (spec.size[1] - spec.size[0]) * weight,
        age: 0,
        fall: spec.fall,
        sway: between([10, 24]),
        swayPhase: Math.random() * TAU,
        spin: between([3, 6]),
        spinPhase: Math.random() * TAU,
      });
    },
    ripple(x, y, from, to) {
      if (frame) {
        ripples.push({ x, y, from, to, age: 0 });
      }
    },
    destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
      events.abort();
      resizeObserver.disconnect();
      visibility.disconnect();
      themeObserver.disconnect();
    },
  };
}
