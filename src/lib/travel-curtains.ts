// 两幅窗帘各用两条悬垂链近似：外侧边和内侧边。链顶钉在杆上，张力随离下摆的距离线性增大，
// 下摆最软，惯性力会激起由上往下传的 S 形摆动。两条链频率略有差别，布面摆动时带一点扭转。

// 位置按窗户宽度的比例，与 frame.webp 的窗帘杆、窗台对齐
const rodEnd = 0.105;
const width = 0.165;
const top = 0.094;
const bottom = 0.9;
// 画布左右各外扩的比例，留给下摆摆出窗帘原位
const curtainBleed = 0.08;

const nodes = 24;
const rows = 72;
const columns = 4;
// 链长为 1 时基频约 1.2·√g，g = 14 对应约 1.4 秒一个来回
const gravity = 14;
const damping = 1.5;
const push = 1.3;
const step = 1 / 240;

type Chain = { x: Float64Array; v: Float64Array; gravity: number };

const chain = (stiffness: number): Chain => ({
  x: new Float64Array(nodes + 1),
  v: new Float64Array(nodes + 1),
  gravity: gravity * stiffness,
});

function advance(c: Chain, force: number) {
  const dy = 1 / nodes;
  for (let i = 1; i <= nodes; i++) {
    const above = (1 - (i - 0.5) * dy) * (c.x[i - 1] - c.x[i]);
    const below = i < nodes ? (1 - (i + 0.5) * dy) * (c.x[i + 1] - c.x[i]) : 0;
    // 下摆节点只有半段质量
    const mass = i < nodes ? 1 : 0.5;
    c.v[i] += ((c.gravity * (above + below)) / (dy * dy * mass) - force - damping * c.v[i]) * step;
  }
  for (let i = 1; i <= nodes; i++) {
    c.x[i] += c.v[i] * step;
  }
}

function sample(c: Chain, s: number) {
  const at = s * nodes;
  const i = Math.min(nodes - 1, Math.floor(at));
  return c.x[i] + (c.x[i + 1] - c.x[i]) * (at - i);
}

function energy(c: Chain) {
  let sum = 0;
  for (let i = 1; i <= nodes; i++) {
    sum += Math.abs(c.x[i]) + Math.abs(c.v[i]);
  }
  return sum;
}

export function createCurtains(canvas: HTMLCanvasElement, src: string) {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const ctx = context;
  // 外侧边在前，内侧边稍软、稍慢
  const curtains = [
    { side: -1, chains: [chain(1), chain(0.8)] },
    { side: 1, chains: [chain(0.95), chain(0.77)] },
  ];
  const image = new Image();
  let mirrored: HTMLCanvasElement | null = null;
  let size = 0;
  let rideStart = 0;
  let rideLength = 0;
  let last = 0;
  let frame = 0;

  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!mirrored || !size) {
      return;
    }
    const scale = canvas.width / (size * (1 + curtainBleed * 2));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const h = (bottom - top) * size;
    const w = width * size;
    const cell = w / columns;
    const rowHeight = h / rows;
    for (const { side, chains } of curtains) {
      const [outer, inner] = chains;
      const source = side < 0 ? image : mirrored;
      const left = curtainBleed * size + (side < 0 ? rodEnd * size : size - rodEnd * size - w);
      const sourceRow = source.height / rows;
      const sourceCell = source.width / columns;
      for (let r = 0; r < rows; r++) {
        const s = (r + 0.5) / rows;
        const xo = sample(outer, s) * h;
        const xi = sample(inner, s) * h;
        for (let c = 0; c < columns; c++) {
          const t = (c + 0.5) / columns;
          const shift = xo + (xi - xo) * (side < 0 ? t : 1 - t);
          // 相邻小块多画半像素，避免接缝透出背景
          ctx.drawImage(
            source,
            c * sourceCell,
            r * sourceRow,
            sourceCell,
            sourceRow,
            left + c * cell + shift,
            top * size + r * rowHeight,
            cell + 0.5,
            rowHeight + 0.5,
          );
        }
      }
    }
  };

  const tick = (time: number) => {
    const elapsed = Math.min(0.05, (time - last) / 1000);
    last = time;
    for (let t = 0; t < elapsed; t += step) {
      const phase = (time - (elapsed - t) * 1000 - rideStart) / rideLength;
      // 窗外景色左移即列车向右开：前半程加速、后半程刹车，惯性力与加速度反向
      const force = phase > 0 && phase < 1 ? push * Math.sin(phase * Math.PI * 2) : 0;
      for (const { chains } of curtains) {
        for (const c of chains) {
          advance(c, force);
        }
      }
    }
    draw();
    const riding = time - rideStart < rideLength;
    const moving = curtains.some(({ chains }) => chains.some((c) => energy(c) > 1e-3));
    frame = riding || moving ? requestAnimationFrame(tick) : 0;
  };

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    size = box.width / (1 + curtainBleed * 2);
    const ratio = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    draw();
  };
  const observer = new ResizeObserver(resize);

  image.addEventListener("load", () => {
    const flipped = document.createElement("canvas");
    flipped.width = image.naturalWidth;
    flipped.height = image.naturalHeight;
    const flip = flipped.getContext("2d")!;
    flip.scale(-1, 1);
    flip.drawImage(image, -image.naturalWidth, 0);
    mirrored = flipped;
    observer.observe(canvas);
  });
  image.src = src;

  return {
    ride(duration: number) {
      rideStart = performance.now();
      rideLength = duration;
      if (!frame) {
        last = rideStart;
        frame = requestAnimationFrame(tick);
      }
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
    },
  };
}
