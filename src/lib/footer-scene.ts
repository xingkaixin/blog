export type FooterScene = "writing" | "building" | "photography" | "rss";

type Ctx = CanvasRenderingContext2D;
type Path = (g: Ctx) => void;
type Box = [x: number, y: number, w: number, h: number];
type Pair = [bg: number, fg: number];

type Palette = {
  paper: string;
  ink: string;
  accent: string;
  accentSoft: string;
  cells: { paper: number; ink: Pair[]; accent: Pair[] };
};

// 插画在 W×H 的设计坐标里绘制，按画布高度等比缩放并贴底
const W = 1440;
const H = 400;
const FOCAL = { x: 1110, y: 92 };
const CAP_TOP = 162;

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mod = (a: number, n: number) => ((a % n) + n) % n;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.trim().slice(1), 16);
  return [n >> 16, (n >> 8) & 0xff, n & 0xff];
}

function mix(a: string, b: string, t: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ImageData 以小端 ABGR 存储 Uint32
function packed(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const ink = (n: number) => v(`--ink-${n}`);
  const paper = ink(50);
  const accent = v("--accent");
  const pair = (bg: string, fg: string): Pair => [packed(bg), packed(fg)];
  return {
    paper,
    ink: ink(700),
    accent,
    accentSoft: mix(paper, accent, 0.35),
    cells: {
      paper: packed(paper),
      ink: [
        pair(ink(100), ink(300)),
        pair(ink(200), ink(400)),
        pair(ink(300), ink(500)),
        pair(ink(500), ink(600)),
        pair(ink(700), ink(600)),
        pair(ink(800), ink(700)),
      ],
      accent: [
        pair(mix(paper, accent, 0.2), mix(paper, accent, 0.45)),
        pair(mix(paper, accent, 0.4), mix(paper, accent, 0.7)),
        pair(mix(paper, accent, 0.75), accent),
        pair(accent, mix(accent, ink(800), 0.35)),
        pair(mix(accent, ink(800), 0.4), accent),
      ],
    },
  };
}

const poly =
  (pts: [number, number][]): Path =>
  (g) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };

const PATTERNS: ((x: number, y: number) => boolean)[] = [
  (x, y) => mod(Math.hypot(x, y) + (Math.atan2(y, x) / (2 * Math.PI)) * 4, 4) < 2,
  (x, y) => mod(x + y, 4) < 2,
  (x, y) => mod(x - y, 3) === 0,
  (x, y) => mod(x, 4) === 0 || mod(y, 4) === 0,
  (x, y) => mod(x, 3) !== 0 && mod(y, 3) !== 0,
  (x, y) => (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => mod(x, 3) === 0 && mod(y, 3) === 0,
  (x, y) => Math.max(Math.abs(x), Math.abs(y)) % 4 < 2,
  (x, y) => (Math.abs(x) + Math.abs(y)) % 4 < 2,
  (_x, y) => mod(y, 3) === 0,
  (x, y) => mod(x + (mod(y, 8) < 4 ? mod(y, 4) : 3 - mod(y, 4)), 6) < 3,
  (x, y) => mod(x, 5) <= mod(y, 5),
  (x, y) => mod(x + y, 2) === 0,
];

export function mountFooterScene(canvas: HTMLCanvasElement, scene: FooterScene, animate: boolean) {
  const ctx = canvas.getContext("2d")!;
  const layer = document.createElement("canvas");
  let pal = readPalette(canvas);
  let s = 1;
  let offX = 0;
  let dpr = 1;
  let x0 = 0;
  let x1 = W;
  let raf = 0;
  let active = false;
  let last = -Infinity;

  function hatch(
    g: Ctx,
    path: Path,
    angle: number,
    gap: number,
    alpha: number,
    [bx, by, bw, bh]: Box,
    lw = 0.7,
  ) {
    g.save();
    path(g);
    g.clip();
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const r = Math.hypot(bw, bh) / 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    g.beginPath();
    for (let t = -r; t <= r; t += gap) {
      const px = cx - dy * t;
      const py = cy + dx * t;
      g.moveTo(px - dx * r, py - dy * r);
      g.lineTo(px + dx * r, py + dy * r);
    }
    g.globalAlpha = alpha;
    g.lineWidth = lw;
    g.strokeStyle = pal.ink;
    g.stroke();
    g.restore();
  }

  function stroke(g: Ctx, path: Path, alpha = 1, lw = 1) {
    path(g);
    g.globalAlpha = alpha;
    g.lineWidth = lw;
    g.strokeStyle = pal.ink;
    g.stroke();
    g.globalAlpha = 1;
  }

  function fillPaper(g: Ctx, path: Path) {
    path(g);
    g.fillStyle = pal.paper;
    g.fill();
  }

  // ---------- 静态版画层 ----------

  function drawLines(g: Ctx) {
    const r = rng(7);
    g.strokeStyle = pal.ink;
    g.lineWidth = 0.8;
    for (let y = 0; y < H; y += 3) {
      // 顶部留白给文字，断线从上往下逐渐变密
      const fade = clamp((y - 20) / 160, 0, 1);
      if (!fade) {
        continue;
      }
      const water = y > 300;
      let x = x0 - r() * 120;
      g.beginPath();
      while (x < x1) {
        const len = water ? 8 + r() * 100 : 20 + r() * 240;
        g.moveTo(x, y + 0.5);
        g.lineTo(x + len, y + 0.5);
        x += len + (water ? 3 + r() * 26 : 1 + r() * 10);
      }
      g.globalAlpha = (water ? 0.2 + r() * 0.16 : 0.12 + r() * 0.12) * fade;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // 按从后到前排列：后画的圆盖住前面圆的内部，只留下交叉的外轮廓
  const CLOUDS: { base: number; c: [number, number, number][] }[] = [
    {
      base: 150,
      c: [
        [650, 120, 44],
        [596, 132, 24],
        [706, 104, 38],
        [752, 116, 28],
        [792, 130, 18],
      ],
    },
    {
      base: 118,
      c: [
        [912, 92, 32],
        [956, 86, 24],
        [878, 104, 14],
      ],
    },
  ];

  function drawClouds(g: Ctx) {
    g.strokeStyle = pal.ink;
    g.lineWidth = 0.9;
    for (const { base, c } of CLOUDS) {
      g.save();
      g.beginPath();
      g.rect(x0, 0, x1 - x0, base);
      g.clip();
      for (const [x, y, r] of c) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.globalAlpha = 1;
        g.fillStyle = pal.paper;
        g.fill();
        g.globalAlpha = 0.55;
        g.stroke();
      }
      g.restore();
    }
  }

  const HILL: [number, number][] = [
    [30, 300],
    [110, 292],
    [190, 276],
    [260, 254],
    [330, 234],
    [410, 216],
    [480, 207],
    [560, 204],
    [630, 206],
    [700, 214],
    [760, 227],
    [820, 238],
    [880, 244],
  ];
  const hillY = (x: number) => {
    for (let i = 1; i < HILL.length; i++) {
      const [ax, ay] = HILL[i - 1];
      const [bx, by] = HILL[i];
      if (x <= bx) {
        return ay + ((by - ay) * (x - ax)) / (bx - ax);
      }
    }
    return HILL[HILL.length - 1][1];
  };

  function drawHill(g: Ctx) {
    const patch = (xa: number, xb: number, yb: number) =>
      poly([
        [xa, hillY(xa)],
        [xb, hillY(xb)],
        [xb - 10, yb],
        [xa - 10, yb],
      ]);
    hatch(g, patch(302, 340, 282), 1.25, 2.6, 0.32, [280, 220, 80, 70]);
    hatch(g, patch(448, 470, 248), 1.25, 2.6, 0.32, [430, 200, 50, 50]);
    hatch(
      g,
      poly([
        [620, hillY(620)],
        [700, hillY(700)],
        [760, hillY(760)],
        [810, hillY(810)],
        [800, 270],
        [670, 262],
        [630, 250],
      ]),
      1.2,
      2.2,
      0.28,
      [600, 200, 220, 80],
    );
    g.beginPath();
    HILL.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.globalAlpha = 0.75;
    g.lineWidth = 1;
    g.strokeStyle = pal.ink;
    g.stroke();
    g.globalAlpha = 1;
  }

  function drawSun(g: Ctx) {
    const disk: Path = (g) => {
      g.beginPath();
      g.arc(1292, 70, 30, 0, Math.PI * 2);
    };
    fillPaper(g, disk);
    hatch(g, disk, -Math.PI / 4, 3.2, 0.6, [1260, 38, 64, 64], 0.8);
  }

  function drawCliff(g: Ctx) {
    const r = rng(11);
    const right = x1 + 10;
    const shape = poly([
      [880, 244],
      [930, 236],
      [1150, 232],
      [right, 228],
      [right, H + 10],
      [800, H + 10],
    ]);
    fillPaper(g, shape);
    g.save();
    shape(g);
    g.clip();
    g.strokeStyle = pal.ink;
    g.lineWidth = 0.75;
    for (let x = 800; x < right; x += 1.7) {
      g.beginPath();
      let y = 226 + r() * 6;
      while (y < H) {
        const len = 3 + r() * 24;
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 0.8, y + len);
        y += len + 1 + r() * 6;
      }
      g.globalAlpha = 0.25 + r() * 0.35;
      g.stroke();
    }
    g.globalAlpha = 0.8;
    g.lineWidth = 1.1;
    [264, 290, 316, 342, 368, 394].forEach((yb, k) => {
      g.beginPath();
      for (let x = 790; x <= right; x += 8) {
        const y = yb + 4 * Math.sin(x / 90 + k) + 2 * Math.sin(x / 37 + k * 2);
        if (x === 790) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }
      g.stroke();
    });
    g.restore();
    stroke(
      g,
      (g) => {
        g.beginPath();
        g.moveTo(800, H + 10);
        g.lineTo(880, 244);
        g.lineTo(930, 236);
        g.lineTo(1150, 232);
        g.lineTo(right, 228);
      },
      0.9,
    );
  }

  function cypress(x: number, top: number, base: number, w: number): Path {
    const h = base - top;
    return (g) => {
      g.beginPath();
      g.moveTo(x, top);
      g.bezierCurveTo(
        x + w * 0.15,
        top + h * 0.2,
        x + w * 0.58,
        top + h * 0.55,
        x + w * 0.45,
        base,
      );
      g.lineTo(x - w * 0.45, base);
      g.bezierCurveTo(x - w * 0.58, top + h * 0.55, x - w * 0.15, top + h * 0.2, x, top);
      g.closePath();
    };
  }

  function drawTrees(g: Ctx) {
    const trees: [number, number, number][] = [
      [972, 150, 18],
      [1006, 124, 24],
      [1302, 140, 20],
      [1338, 166, 16],
    ];
    for (const [x, top, w] of trees) {
      const p = cypress(x, top, 235, w);
      fillPaper(g, p);
      hatch(g, p, Math.PI / 2, 1.6, 0.8, [x - w, top, w * 2, 235 - top], 0.8);
      stroke(g, p, 0.9);
    }
  }

  function drawPedestal(g: Ctx) {
    const column = poly([
      [1088, 168],
      [1132, 168],
      [1132, 234],
      [1088, 234],
    ]);
    const cap = poly([
      [1078, CAP_TOP],
      [1142, CAP_TOP],
      [1142, 168],
      [1078, 168],
    ]);
    fillPaper(g, column);
    hatch(
      g,
      poly([
        [1112, 168],
        [1132, 168],
        [1132, 234],
        [1112, 234],
      ]),
      Math.PI / 2,
      2,
      0.7,
      [1108, 162, 30, 80],
    );
    stroke(g, column, 0.9);
    fillPaper(g, cap);
    stroke(g, cap, 0.9);
  }

  function drawBoat(g: Ctx) {
    const sail = poly([
      [163, 304],
      [163, 346],
      [191, 346],
    ]);
    const hull = poly([
      [140, 348],
      [196, 348],
      [189, 357],
      [148, 357],
    ]);
    fillPaper(g, sail);
    hatch(g, sail, Math.PI / 2, 2, 0.55, [160, 300, 35, 50]);
    stroke(g, sail, 0.9);
    fillPaper(g, hull);
    hatch(g, hull, 0, 2, 0.6, [138, 346, 60, 14]);
    stroke(g, hull, 0.9);
    g.beginPath();
    for (const [a, b, y] of [
      [150, 186, 361],
      [154, 180, 365],
      [158, 174, 369],
    ]) {
      g.moveTo(a, y);
      g.lineTo(b, y);
    }
    g.globalAlpha = 0.45;
    g.stroke();
    g.globalAlpha = 1;
  }

  function drawRocks(g: Ctx) {
    const dome =
      (x: number, y: number, rx: number, ry: number): Path =>
      (g) => {
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, Math.PI, 0);
        g.closePath();
      };
    for (const [x, y, rx, ry] of [
      [640, 372, 26, 22],
      [669, 369, 15, 13],
      [709, 376, 17, 9],
    ] as const) {
      const p = dome(x, y, rx, ry);
      fillPaper(g, p);
      hatch(g, p, 0.35, 2.4, 0.7, [x - rx, y - ry, rx * 2, ry]);
      stroke(g, p, 0.9);
    }
  }

  function buildStatic() {
    layer.width = canvas.width;
    layer.height = canvas.height;
    const g = layer.getContext("2d")!;
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * offX, 0);
    g.fillStyle = pal.paper;
    g.fillRect(x0, 0, x1 - x0, H);
    drawLines(g);
    drawClouds(g);
    drawHill(g);
    drawSun(g);
    drawCliff(g);
    drawTrees(g);
    drawPedestal(g);
    drawBoat(g);
    drawRocks(g);
  }

  // ---------- writing：墨点从台座平抛入水 ----------

  const SHOT = { from: 1110, to: 520, fly: 5, hold: 1.6 };
  const arcY = (x: number) => 70 + 0.001954 * (x - 900) ** 2;
  const MARKS = Array.from(
    { length: 12 },
    (_, k) => SHOT.from - ((SHOT.from - SHOT.to) / 12) * (k + 1),
  );

  function drawShot(g: Ctx, t: number) {
    const cycle = SHOT.fly + SHOT.hold;
    const elapsed = animate ? t % cycle : cycle;
    const p = Math.min(elapsed / SHOT.fly, 1);
    const bx = SHOT.from + (SHOT.to - SHOT.from) * p;

    g.strokeStyle = pal.ink;
    if (bx < SHOT.from) {
      g.beginPath();
      for (let x = SHOT.from; x >= bx; x -= 3) {
        if (x === SHOT.from) {
          g.moveTo(x, arcY(x));
        } else {
          g.lineTo(x, arcY(x));
        }
      }
      g.setLineDash([1.2, 3]);
      g.lineWidth = 1;
      g.globalAlpha = 0.7;
      g.stroke();
      g.setLineDash([]);
    }

    for (const mx of MARKS) {
      g.beginPath();
      g.arc(mx, arcY(mx), 3.4, 0, Math.PI * 2);
      g.globalAlpha = 1;
      g.fillStyle = pal.paper;
      g.fill();
      g.globalAlpha = mx >= bx ? 0.9 : 0.3;
      g.lineWidth = 1;
      g.stroke();
    }

    if (animate && p === 1) {
      const k = (elapsed - SHOT.fly) / SHOT.hold;
      for (const lag of [0, 0.25]) {
        const q = clamp((k - lag) / 0.75, 0, 1);
        if (!q) {
          continue;
        }
        g.beginPath();
        g.ellipse(SHOT.to, arcY(SHOT.to) + 4, 8 + q * 30, 2 + q * 6, 0, 0, Math.PI * 2);
        g.globalAlpha = 0.7 * (1 - q);
        g.stroke();
      }
    }

    g.beginPath();
    g.arc(bx, arcY(bx), 6, 0, Math.PI * 2);
    g.globalAlpha = 1;
    g.fillStyle = pal.accent;
    g.fill();
    g.lineWidth = 1;
    g.stroke();
  }

  // ---------- photography：自转地球仪与取景框 ----------

  const GLOBE = { x: FOCAL.x, y: FOCAL.y, r: 56 };
  const norm = (v: number[]) => {
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  };
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  // 地轴朝向观察者并偏右下，所以南极点落在球面右下方
  const AXIS = norm([0.48, 0.35, 0.8]);
  const U = norm(cross(AXIS, [0, 0, 1]));
  const V = cross(AXIS, U);
  const RING = { rot: -0.29, outer: [78, 20] as const, inner: [72, 16.5] as const };
  const FRAME: Box = [1018, 16, 184, 140];
  const SHUTTER = { every: 8, steps: [12, 7, 4], step: 0.18 };

  function spherePoint(lat: number, lon: number) {
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    const ca = Math.cos(lon);
    const sa = Math.sin(lon);
    return [0, 1, 2].map((i) => cl * (ca * U[i] + sa * V[i]) + sl * AXIS[i]);
  }

  function drawCurve(g: Ctx, sample: (f: number) => number[], n: number) {
    let pen = false;
    for (let i = 0; i <= n; i++) {
      const p = sample(i / n);
      if (p[2] <= 0) {
        pen = false;
        continue;
      }
      const x = GLOBE.x + p[0] * GLOBE.r;
      const y = GLOBE.y + p[1] * GLOBE.r;
      if (pen) {
        g.lineTo(x, y);
      } else {
        g.moveTo(x, y);
      }
      pen = true;
    }
  }

  function ringArc(
    g: Ctx,
    [rx, ry]: readonly [number, number],
    from: number,
    to: number,
    ccw = false,
  ) {
    g.ellipse(GLOBE.x, GLOBE.y, rx, ry, RING.rot, from, to, ccw);
  }

  function drawGlobe(g: Ctx, t: number) {
    const { x, y, r } = GLOBE;
    const spin = t * 0.2;
    g.strokeStyle = pal.ink;

    g.beginPath();
    ringArc(g, RING.outer, Math.PI, Math.PI * 2);
    g.moveTo(x - RING.inner[0] * Math.cos(RING.rot), y - RING.inner[0] * Math.sin(RING.rot));
    ringArc(g, RING.inner, Math.PI, Math.PI * 2);
    g.lineWidth = 1;
    g.globalAlpha = 0.9;
    g.stroke();

    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.globalAlpha = 1;
    g.fillStyle = pal.paper;
    g.fill();

    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.clip();
    g.beginPath();
    for (let k = 0; k < 12; k++) {
      const lon = (k * Math.PI) / 6 + spin;
      drawCurve(g, (f) => spherePoint(-Math.PI / 2 + f * Math.PI, lon), 40);
    }
    for (const deg of [-60, -30, 0, 30, 60]) {
      const lat = (deg * Math.PI) / 180;
      drawCurve(g, (f) => spherePoint(lat, f * Math.PI * 2 + spin), 80);
    }
    g.lineWidth = 0.9;
    g.globalAlpha = 0.85;
    g.stroke();
    g.restore();

    hatch(
      g,
      (g) => {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.arc(x - 10, y - 12, r, 0, Math.PI * 2, true);
      },
      Math.PI / 4,
      2.6,
      0.55,
      [x - r, y - r, r * 2, r * 2],
    );

    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.globalAlpha = 1;
    g.lineWidth = 1.4;
    g.stroke();

    g.beginPath();
    ringArc(g, RING.outer, 0, Math.PI);
    ringArc(g, RING.inner, Math.PI, 0, true);
    g.closePath();
    g.fillStyle = pal.paper;
    g.fill();
    g.beginPath();
    ringArc(g, RING.outer, 0, Math.PI);
    g.moveTo(x + RING.inner[0] * Math.cos(RING.rot), y + RING.inner[0] * Math.sin(RING.rot));
    ringArc(g, RING.inner, 0, Math.PI);
    g.lineWidth = 1.1;
    g.stroke();
  }

  function drawFrame(g: Ctx, flash: boolean) {
    const [fx, fy, fw, fh] = FRAME;
    const len = 14;
    g.beginPath();
    for (const [cx, cy, sx, sy] of [
      [fx, fy, 1, 1],
      [fx + fw, fy, -1, 1],
      [fx, fy + fh, 1, -1],
      [fx + fw, fy + fh, -1, -1],
    ] as const) {
      g.moveTo(cx + sx * len, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + sy * len);
    }
    g.globalAlpha = flash ? 1 : 0.6;
    g.lineWidth = flash ? 1.8 : 1.2;
    g.strokeStyle = flash ? pal.accent : pal.ink;
    g.stroke();
    g.globalAlpha = 1;
  }

  const pix = document.createElement("canvas");

  // 快门后地球仪先被粗像素化，再分几步显影回线稿
  function drawPhotography(g: Ctx, t: number) {
    const since = animate ? t % SHUTTER.every : Infinity;
    const block = SHUTTER.steps[Math.floor(since / SHUTTER.step)];
    drawFrame(g, block !== undefined);
    if (block === undefined) {
      drawGlobe(g, t);
      return;
    }
    const [fx, fy, fw, fh] = FRAME;
    pix.width = Math.ceil(fw / block);
    pix.height = Math.ceil(fh / block);
    const p = pix.getContext("2d")!;
    p.setTransform(1 / block, 0, 0, 1 / block, -fx / block, -fy / block);
    drawGlobe(p, t);
    g.imageSmoothingEnabled = false;
    g.drawImage(pix, fx, fy, pix.width * block, pix.height * block);
    g.imageSmoothingEnabled = true;
  }

  // ---------- building：台座上的像素细胞团 ----------

  const CELL = { size: 96, px: 1.7, s: 12, gap: 1.4, cx: 48, cy: 48, rx: 34, ry: 40 };
  const cellCanvas = document.createElement("canvas");
  cellCanvas.width = CELL.size;
  cellCanvas.height = CELL.size;
  const cellCtx = cellCanvas.getContext("2d")!;
  const cellImage = cellCtx.createImageData(CELL.size, CELL.size);
  const cellBuf = new Uint32Array(cellImage.data.buffer);
  const cols = Math.ceil(CELL.size / CELL.s);

  const hash = (i: number, k: number) => {
    const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  const seeds = Array.from({ length: cols * cols }, (_, id) => ({
    bx: (id % cols) * CELL.s + CELL.s / 2,
    by: Math.floor(id / cols) * CELL.s + CELL.s / 2,
    w1: 0.5 + hash(id, 1),
    w2: 0.5 + hash(id, 2),
    p1: hash(id, 3) * 6.28,
    p2: hash(id, 4) * 6.28,
    size: 0.7 + hash(id, 5) * 0.6,
    tone: hash(id, 6) - 0.5,
    hue: hash(id, 7) - 0.5,
    pat: hash(id, 8) * PATTERNS.length,
    patRate: 0.3 + hash(id, 9) * 1.2,
    stray: hash(id, 10),
    x: 0,
    y: 0,
    r: 0,
    colors: [0, 0] as Pair,
    pattern: PATTERNS[0],
  }));

  function updateCells(t: number) {
    const { cx, cy, rx, ry, s: S } = CELL;
    const kx = cx + rx * 0.44 * Math.sin(0.31 * t);
    const ky = cy + ry * 0.4 * Math.sin(0.23 * t + 1);
    const ax = cx + rx * 0.7 * Math.sin(0.27 * t + 2);
    const ay = cy + ry * 0.58 * Math.sin(0.19 * t + 0.5);
    const ox = cx + 3 * Math.sin(0.2 * t);
    const oy = cy + 2.5 * Math.cos(0.17 * t);
    for (const c of seeds) {
      c.x = c.bx + 0.22 * S * Math.sin(t * c.w1 + c.p1);
      c.y = c.by + 0.22 * S * Math.sin(t * c.w2 + c.p2);
      const dx = (c.x - ox) / rx;
      const dy = (c.y - oy) / ry;
      const th = Math.atan2(dy, dx);
      const edge =
        1 +
        0.16 * Math.sin(2 * th + 0.5 * t) +
        0.07 * Math.sin(4 * th - 0.6 * t + 0.4) +
        0.12 * Math.sin(3 * th - 0.37 * t + 1.3) +
        0.06 * Math.sin(5 * th + 0.8 * t + 2.1);
      const m = edge - Math.hypot(dx, dy);
      if (m > 0) {
        c.r = Math.min(S * 1.2, 3 + m * 50 * c.size);
      } else {
        c.r = m > -0.1 && c.stray > 0.82 ? 2 : 0;
      }
      if (!c.r) {
        continue;
      }
      const dark = clamp(
        1 -
          Math.hypot((c.x - kx) / (rx * 1.4), (c.y - ky) / (ry * 1.13)) +
          c.tone * 0.4 -
          (m < 0.12 ? 0.25 : 0),
        0,
        0.999,
      );
      const hot =
        1 - Math.hypot((c.x - ax) / (rx * 0.8), (c.y - ay) / (ry * 0.66)) + c.hue * 0.5 > 0.45;
      const ramp = hot ? pal.cells.accent : pal.cells.ink;
      c.colors = ramp[Math.floor(Math.pow(dark, 0.8) * ramp.length)]!;
      c.pattern = PATTERNS[Math.floor(c.pat + t * c.patRate) % PATTERNS.length]!;
    }
  }

  function renderCells() {
    const { size, s: S, gap } = CELL;
    cellBuf.fill(0);
    for (let y = 0; y < size; y++) {
      const gj = Math.floor(y / S);
      for (let x = 0; x < size; x++) {
        const gi = Math.floor(x / S);
        let d1 = Infinity;
        let d2 = Infinity;
        let best: (typeof seeds)[number] | null = null;
        for (let j = gj - 1; j <= gj + 1; j++) {
          if (j < 0 || j >= cols) {
            continue;
          }
          for (let i = gi - 1; i <= gi + 1; i++) {
            if (i < 0 || i >= cols) {
              continue;
            }
            const c = seeds[j * cols + i];
            if (!c.r) {
              continue;
            }
            const ax = Math.abs(x - c.x);
            const ay = Math.abs(y - c.y);
            // 八边形距离让细胞带 45° 切角
            const d = Math.max(ax, ay, (ax + ay) * 0.75);
            if (d < d1) {
              d2 = d1;
              d1 = d;
              best = c;
            } else if (d < d2) {
              d2 = d;
            }
          }
        }
        if (!best || d1 >= best.r) {
          continue;
        }
        if (d2 - d1 < gap) {
          cellBuf[y * size + x] = pal.cells.paper;
          continue;
        }
        const on = best.pattern(x - Math.round(best.x), y - Math.round(best.y));
        cellBuf[y * size + x] = best.colors[on ? 1 : 0];
      }
    }
    cellCtx.putImageData(cellImage, 0, 0);
  }

  function drawCells(g: Ctx, t: number) {
    updateCells(t);
    renderCells();
    const span = CELL.size * CELL.px;
    g.save();
    g.beginPath();
    g.rect(FOCAL.x - span / 2, FOCAL.y - span / 2, span, CAP_TOP - (FOCAL.y - span / 2));
    g.clip();
    g.imageSmoothingEnabled = false;
    g.drawImage(cellCanvas, FOCAL.x - span / 2, FOCAL.y - span / 2, span, span);
    g.restore();
  }

  // ---------- rss：台座发出信号，像素包落到小船上 ----------

  const BEACON = { x: FOCAL.x + 8, y: CAP_TOP - 8 };
  const PACKET = { fly: 3.6, every: 1.5, count: 4, cells: 6, px: 2.4 };
  const ROUTE = { c: [640, 110], to: [167, 300] } as const;

  function routePoint(q: number): [number, number] {
    const u = 1 - q;
    return [
      u * u * BEACON.x + 2 * u * q * ROUTE.c[0] + q * q * ROUTE.to[0],
      u * u * BEACON.y + 2 * u * q * ROUTE.c[1] + q * q * ROUTE.to[1],
    ];
  }

  function drawPacket(g: Ctx, q: number, seed: number) {
    const [x, y] = routePoint(q);
    const n = PACKET.cells;
    const scale = q > 0.9 ? (1 - q) / 0.1 : 1;
    const px = PACKET.px * scale;
    const pattern = PATTERNS[seed % PATTERNS.length];
    const half = (n - 1) / 2;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const ax = Math.abs(i - half);
        const ay = Math.abs(j - half);
        if (Math.max(ax, ay, (ax + ay) * 0.75) > half + 0.3) {
          continue;
        }
        g.fillStyle = pattern(i, j) ? pal.accent : pal.accentSoft;
        g.fillRect(x + (i - n / 2) * px, y + (j - n / 2) * px, px, px);
      }
    }
  }

  function drawBroadcast(g: Ctx, t: number) {
    const { x, y } = BEACON;
    g.strokeStyle = pal.ink;
    g.setLineDash([1.5, 4]);
    g.lineWidth = 1;
    const phases = animate ? [0, 1, 2].map((k) => ((t / 1.8 + k) % 3) / 3) : [0.25, 0.55, 0.85];
    for (const f of phases) {
      g.beginPath();
      g.arc(x, y, 50 + (1 - (1 - f) ** 2) * 200, Math.PI, Math.PI * 1.5);
      g.globalAlpha = 0.75 * (1 - f);
      g.stroke();
    }
    g.setLineDash([]);

    g.lineCap = "round";
    g.lineWidth = 4;
    g.globalAlpha = 1;
    for (const r of [16, 30]) {
      g.beginPath();
      g.arc(x, y, r, Math.PI, Math.PI * 1.5);
      g.stroke();
    }
    g.lineCap = "butt";
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fillStyle = pal.accent;
    g.fill();

    for (let k = 0; k < PACKET.count; k++) {
      const q = animate
        ? ((t - k * PACKET.every) % (PACKET.every * PACKET.count)) / PACKET.fly
        : (k + 1) / (PACKET.count + 1);
      if (q < 0 || q >= 1) {
        continue;
      }
      drawPacket(g, q, k * 5 + 3);
    }
  }

  // ---------- 组装 ----------

  const PIECES: Record<FooterScene, { draw: (g: Ctx, t: number) => void; fps?: number }> = {
    writing: { draw: drawShot },
    photography: { draw: drawPhotography },
    building: { draw: drawCells, fps: 12 },
    rss: { draw: drawBroadcast },
  };
  const piece = PIECES[scene];

  function draw(t: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * offX, 0);
    piece.draw(ctx, t);
    ctx.globalAlpha = 1;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (piece.fps && now - last < 1000 / piece.fps) {
      return;
    }
    last = now;
    draw(now / 1000);
  }

  function sync() {
    const run = animate && active;
    if (run && !raf) {
      raf = requestAnimationFrame(frame);
    }
    if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function layout() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) {
      return;
    }
    s = h / H;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // 居中构图；窄屏时让台座主角留在画面右侧
    offX = Math.min((w - W * s) / 2, w - 110 - FOCAL.x * s);
    x0 = -offX / s;
    x1 = (w - offX) / s;
    buildStatic();
    draw(animate ? performance.now() / 1000 : 3);
  }

  function repaint() {
    pal = readPalette(canvas);
    buildStatic();
    draw(animate ? performance.now() / 1000 : 3);
  }

  const resize = new ResizeObserver(layout);
  resize.observe(canvas);
  const theme = new MutationObserver(repaint);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return {
    setActive(on: boolean) {
      active = on;
      sync();
    },
    destroy() {
      active = false;
      sync();
      resize.disconnect();
      theme.disconnect();
    },
  };
}
