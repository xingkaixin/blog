/**
 * 首页林雾抖动天幕：4×4 Bayer 有序抖动，将 Forest 绿灰、胶片暮色与深林墨夜压在同一套像素栅格中。
 * 优先走 WebGL2 全屏片元着色器，不可用或上下文丢失时降级到低分辨率 Canvas 2D。
 */

export type Rgb = readonly [number, number, number];
export type SkyPalette = readonly [Rgb, Rgb, Rgb, Rgb, Rgb];

export interface SkySceneState {
  /** 归一化日夜进度：0 清晨客厅，0.35 暮色招呼，0.7+ 深林夜色 */
  dayProgress: number;
  /** 0 白天，1 夜晚（受暗色主题或滚动入夜驱动） */
  nightWeight: number;
  /** 0–1 暮色占比，在「打个招呼」附近达到峰值 */
  duskWeight: number;
  /** 文字避让椭圆中心与半径（归一化到 0–1，y 向下） */
  dimCenter: readonly [number, number];
  dimRadius: readonly [number, number];
  dimStrength: number;
}

export interface ForestSkyBackdrop {
  /** progress 对应 HomeStory 的 0–3 场景进度 */
  setProgress(progress: number): void;
  setPaused(paused: boolean): void;
  setPointer(x: number, y: number, active: boolean): void;
  destroy(): void;
}

const DAY_PALETTE: SkyPalette = [
  [140, 172, 159],
  [178, 203, 193],
  [213, 229, 222],
  [236, 244, 240],
  [248, 250, 249],
];

const DUSK_PALETTE: SkyPalette = [
  [59, 76, 72],
  [132, 116, 108],
  [196, 132, 98],
  [231, 189, 140],
  [247, 234, 212],
];

const NIGHT_PALETTE: SkyPalette = [
  [10, 15, 13],
  [18, 28, 24],
  [31, 49, 43],
  [62, 92, 82],
  [188, 212, 200],
];

const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (value) => (value + 0.5) / 16,
);

const ASCII_RAMP = " .:-=+*#%@";
const CELL_PX = 3;
const MAX_DPR = 2;
const LENS_RADIUS = 78;

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function smoothstep(from: number, to: number, value: number) {
  const x = clamp01((value - from) / (to - from));
  return x * x * (3 - 2 * x);
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

export function computeSkySceneState(
  scrollProgress: number,
  darkTheme: boolean,
  narrow: boolean,
): SkySceneState {
  const p = Math.max(0, Math.min(3, scrollProgress));
  const dayProgress = clamp01(p / 2.2);
  const scrollNight = smoothstep(1.28, 1.78, p);
  const nightWeight = darkTheme ? 1 : scrollNight;
  const duskWeight = darkTheme ? 0 : smoothstep(0.42, 0.96, p) * (1 - smoothstep(1.22, 1.72, p));

  if (narrow) {
    return {
      dayProgress,
      nightWeight,
      duskWeight,
      dimCenter: [0.5, 0.34],
      dimRadius: [0.54, 0.38],
      dimStrength: nightWeight > 0.5 ? 0.54 : 0.64,
    };
  }

  // 文字避让区跟随 4 幕文案重心：客厅(左) -> 打个招呼(右) -> 片尾(左) -> 池塘(上)
  const toHello = smoothstep(0.45, 0.95, p);
  const toCredits = smoothstep(1.4, 1.9, p);
  const toPond = smoothstep(2.35, 2.85, p);

  const dimX = lerp(lerp(lerp(0.22, 0.68, toHello), 0.24, toCredits), 0.34, toPond);
  const dimY = lerp(lerp(lerp(0.46, 0.48, toHello), 0.48, toCredits), 0.22, toPond);
  const dimRx = lerp(0.3, 0.36, toPond);
  const dimRy = lerp(0.44, 0.24, toPond);

  return {
    dayProgress,
    nightWeight,
    duskWeight,
    dimCenter: [dimX, dimY],
    dimRadius: [dimRx, dimRy],
    dimStrength: nightWeight > 0.5 ? 0.52 : 0.62,
  };
}

export function resolveSkyPalette(
  state: Pick<SkySceneState, "duskWeight" | "nightWeight">,
): SkyPalette {
  const { duskWeight, nightWeight } = state;
  const mixStep = (index: number): Rgb => {
    const dayOrDusk = mixRgb(DAY_PALETTE[index], DUSK_PALETTE[index], duskWeight);
    return mixRgb(dayOrDusk, NIGHT_PALETTE[index], nightWeight);
  };
  return [mixStep(0), mixStep(1), mixStep(2), mixStep(3), mixStep(4)];
}

// 确定性值噪声，供 CPU 降级路径与 ASCII 透镜采样共用，确保透镜与 WebGL 云层高度呼应
const PERM = new Uint8Array(512);
{
  for (let i = 0; i < 256; i++) {
    PERM[i] = i;
  }
  let seed = 1337;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    const tmp = PERM[i];
    PERM[i] = PERM[j];
    PERM[j] = tmp;
  }
  for (let i = 0; i < 256; i++) {
    PERM[i + 256] = PERM[i];
  }
}

function hash2Cpu(ix: number, iy: number) {
  return PERM[(PERM[ix & 255] + (iy & 255)) & 255] / 255;
}

function noiseCpu(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2Cpu(ix, iy);
  const b = hash2Cpu(ix + 1, iy);
  const c = hash2Cpu(ix, iy + 1);
  const d = hash2Cpu(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmCpu(x: number, y: number) {
  return (
    noiseCpu(x, y) * 0.56 +
    noiseCpu(x * 2.04 + 13.2, y * 2.04 + 7.1) * 0.29 +
    noiseCpu(x * 4.1 + 3.7, y * 4.1 + 19.4) * 0.15
  );
}

function sampleLuminanceCpu(
  nx: number,
  ny: number,
  elapsed: number,
  state: SkySceneState,
  ptrX: number,
  ptrY: number,
  ptrAlpha: number,
  aspect: number,
) {
  const { dayProgress, nightWeight, dimCenter, dimRadius, dimStrength } = state;
  const driftSlow = elapsed * 0.045;
  const driftFast = elapsed * 0.088;

  const skyDay = lerp(0.18, 0.88, ny ** 0.92);
  const skyNight = lerp(0.04, 0.3, ny ** 1.35);
  const skyBase = lerp(skyDay, skyNight, nightWeight);

  const c1 = fbmCpu(nx * 3.2 + driftSlow, ny * 2.4 + dayProgress * 0.45);
  const c2 = fbmCpu(nx * 5.8 - driftFast * 0.65, ny * 4.1 + 4.2);
  const cloud = clamp01((c1 * 0.68 + c2 * 0.32 - 0.37) * 2.15);

  // 日月轨迹
  const celX = lerp(0.62 + dayProgress * 0.2, 0.63, nightWeight);
  const celY = lerp(0.2 + dayProgress * 0.38, 0.21, nightWeight);
  const celDist = Math.hypot((nx - celX) * aspect, ny - celY);
  const celR = lerp(0.068, 0.052, nightWeight);
  let celBoost = 0;
  if (celDist < celR) {
    if (nightWeight > 0.5) {
      const shadowDist = Math.hypot((nx - celX) * aspect - celR * 0.36, ny - celY + celR * 0.12);
      celBoost = shadowDist > celR * 0.82 ? 0.92 : 0.1;
    } else {
      celBoost = 0.9;
    }
  } else if (celDist < celR * 4.2) {
    celBoost = (1 - celDist / (celR * 4.2)) ** 2.1 * lerp(0.42, 0.34, nightWeight);
  }

  let ptrLift = 0;
  if (ptrAlpha > 0.01) {
    const pd = Math.hypot((nx - ptrX) * aspect, ny - ptrY);
    if (pd < 0.24) {
      ptrLift = (1 - pd / 0.24) * lerp(0.16, 0.24, nightWeight) * ptrAlpha;
    }
  }

  const mw = Math.exp(-(((ny - (0.64 - nx * 0.46)) * 4.2) ** 2)) * 0.16 * nightWeight;
  let lum = skyBase + cloud * lerp(0.44, 0.34, nightWeight) + mw + celBoost + ptrLift;

  const dxDim = (nx - dimCenter[0]) / dimRadius[0];
  const dyDim = (ny - dimCenter[1]) / dimRadius[1];
  const dimMask = clamp01(1 - Math.hypot(dxDim, dyDim));
  const dimTarget = lerp(0.94, 0.12, nightWeight);
  lum = lerp(lum, dimTarget, dimMask * dimStrength);

  return clamp01(lum);
}

const VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(gl_VertexID == 2 ? 3.0 : -1.0, gl_VertexID == 1 ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform float uCell;
uniform float uTime;
uniform float uDayProgress;
uniform float uNightWeight;
uniform vec2 uDimCenter;
uniform vec2 uDimRadius;
uniform float uDimStrength;
uniform vec2 uPointer;
uniform float uPointerAlpha;
uniform vec3 uPalette[5];
out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  v += 0.56 * vnoise(p);
  v += 0.29 * vnoise(p * 2.04 + vec2(13.2, 7.1));
  v += 0.15 * vnoise(p * 4.10 + vec2(3.7, 19.4));
  return v;
}

float bayer4(ivec2 cell) {
  int idx = (cell.y & 3) * 4 + (cell.x & 3);
  const float m[16] = float[16](
     0.5,  8.5,  2.5, 10.5,
    12.5,  4.5, 14.5,  6.5,
     3.5, 11.5,  1.5,  9.5,
    15.5,  7.5, 13.5,  5.5
  );
  return m[idx] / 16.0;
}

void main() {
  vec2 fragTop = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  ivec2 cell = ivec2(floor(fragTop / uCell));
  vec2 gridSize = max(vec2(1.0), floor(uResolution / uCell));
  vec2 uv = (vec2(cell) + 0.5) / gridSize;
  float aspect = uResolution.x / max(1.0, uResolution.y);

  float skyDay = mix(0.18, 0.88, pow(clamp(uv.y, 0.0, 1.0), 0.92));
  float skyNight = mix(0.04, 0.30, pow(clamp(uv.y, 0.0, 1.0), 1.35));
  float skyBase = mix(skyDay, skyNight, uNightWeight);

  float driftSlow = uTime * 0.045;
  float driftFast = uTime * 0.088;
  float c1 = fbm(vec2(uv.x * 3.2 + driftSlow, uv.y * 2.4 + uDayProgress * 0.45));
  float c2 = fbm(vec2(uv.x * 5.8 - driftFast * 0.65, uv.y * 4.1 + 4.2));
  float cloud = clamp((c1 * 0.68 + c2 * 0.32 - 0.37) * 2.15, 0.0, 1.0);

  vec2 celPos = vec2(mix(0.62 + uDayProgress * 0.20, 0.63, uNightWeight), mix(0.20 + uDayProgress * 0.38, 0.21, uNightWeight));
  vec2 celDelta = vec2((uv.x - celPos.x) * aspect, uv.y - celPos.y);
  float celDist = length(celDelta);
  float celR = mix(0.068, 0.052, uNightWeight);
  float celBoost = 0.0;
  if (celDist < celR) {
    if (uNightWeight > 0.5) {
      float shadowDist = length(celDelta - vec2(celR * 0.36, -celR * 0.12));
      celBoost = shadowDist > celR * 0.82 ? 0.92 : 0.10;
    } else {
      celBoost = 0.90;
    }
  } else if (celDist < celR * 4.2) {
    celBoost = pow(1.0 - celDist / (celR * 4.2), 2.1) * mix(0.42, 0.34, uNightWeight);
  }

  float ptrLift = 0.0;
  if (uPointerAlpha > 0.01) {
    float pd = length(vec2((uv.x - uPointer.x) * aspect, uv.y - uPointer.y));
    ptrLift = max(0.0, 1.0 - pd / 0.24) * mix(0.16, 0.24, uNightWeight) * uPointerAlpha;
  }

  float mw = exp(-pow((uv.y - (0.64 - uv.x * 0.46)) * 4.2, 2.0)) * 0.16 * uNightWeight;
  float lum = skyBase + cloud * mix(0.44, 0.34, uNightWeight) + mw + celBoost + ptrLift;

  vec2 dimDelta = (uv - uDimCenter) / max(vec2(0.001), uDimRadius);
  float dimMask = clamp(1.0 - length(dimDelta), 0.0, 1.0);
  float dimTarget = mix(0.94, 0.12, uNightWeight);
  lum = clamp(mix(lum, dimTarget, dimMask * uDimStrength), 0.0, 1.0);

  float scaled = lum * 4.0;
  float lo = floor(scaled);
  float frac = scaled - lo;
  int idx = int(min(4.0, lo + (frac > bayer4(cell) ? 1.0 : 0.0)));
  vec3 color = uPalette[idx];

  // 夜间稀疏星点与五点十字亮星
  if (uNightWeight > 0.22 && uv.y < 0.84) {
    vec2 starCell = vec2(cell);
    float r = hash21(starCell * 0.73 + 11.7);
    float twinkle = 0.45 + 0.55 * sin(uTime * 1.9 + r * 62.83);
    float starMask = step(0.9968, r) * twinkle * uNightWeight;
    float crossN = step(0.9992, hash21((starCell + vec2(1.0, 0.0)) * 0.73 + 11.7))
      + step(0.9992, hash21((starCell + vec2(-1.0, 0.0)) * 0.73 + 11.7))
      + step(0.9992, hash21((starCell + vec2(0.0, 1.0)) * 0.73 + 11.7))
      + step(0.9992, hash21((starCell + vec2(0.0, -1.0)) * 0.73 + 11.7));
    float starMix = clamp(starMask + min(1.0, crossN) * 0.45 * uNightWeight, 0.0, 1.0);
    color = mix(color, uPalette[4], starMix);
  }

  fragColor = vec4(color, 1.0);
}
`;

interface GlRenderer {
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  draw(
    elapsed: number,
    state: SkySceneState,
    palette: SkyPalette,
    ptrX: number,
    ptrY: number,
    ptrAlpha: number,
  ): void;
  destroy(): void;
}

function createGlRenderer(canvas: HTMLCanvasElement, onLost: () => void): GlRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    return null;
  }

  const context = gl;
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  const vao = context.createVertexArray();
  const paletteBuffer = new Float32Array(15);

  function cleanup() {
    if (program) {
      context.deleteProgram(program);
      program = null;
    }
    shaders.forEach((shader) => context.deleteShader(shader));
    shaders.length = 0;
    if (vao) {
      context.deleteVertexArray(vao);
    }
  }

  try {
    if (!vao) {
      throw new Error("VAO allocation failed");
    }
    const compile = (type: number, source: string) => {
      const shader = context.createShader(type);
      if (!shader) {
        throw new Error("Shader allocation failed");
      }
      shaders.push(shader);
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        throw new Error(context.getShaderInfoLog(shader) || "Shader compilation failed");
      }
      return shader;
    };

    program = context.createProgram();
    if (!program) {
      throw new Error("Program allocation failed");
    }
    context.attachShader(program, compile(context.VERTEX_SHADER, VERTEX_SHADER));
    context.attachShader(program, compile(context.FRAGMENT_SHADER, FRAGMENT_SHADER));
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) {
      throw new Error(context.getProgramInfoLog(program) || "Program link failed");
    }

    const loc = {
      resolution: context.getUniformLocation(program, "uResolution"),
      cell: context.getUniformLocation(program, "uCell"),
      time: context.getUniformLocation(program, "uTime"),
      dayProgress: context.getUniformLocation(program, "uDayProgress"),
      nightWeight: context.getUniformLocation(program, "uNightWeight"),
      dimCenter: context.getUniformLocation(program, "uDimCenter"),
      dimRadius: context.getUniformLocation(program, "uDimRadius"),
      dimStrength: context.getUniformLocation(program, "uDimStrength"),
      pointer: context.getUniformLocation(program, "uPointer"),
      pointerAlpha: context.getUniformLocation(program, "uPointerAlpha"),
      palette: context.getUniformLocation(program, "uPalette"),
    };

    let dpr = 1;
    let lost = false;

    const handleLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      onLost();
    };
    canvas.addEventListener("webglcontextlost", handleLost);

    return {
      resize(cssWidth, cssHeight, nextDpr) {
        dpr = nextDpr;
        canvas.width = Math.max(1, Math.round(cssWidth * dpr));
        canvas.height = Math.max(1, Math.round(cssHeight * dpr));
        context.viewport(0, 0, canvas.width, canvas.height);
      },
      draw(elapsed, state, palette, ptrX, ptrY, ptrAlpha) {
        if (lost || !program) {
          return;
        }
        for (let i = 0; i < 5; i++) {
          paletteBuffer[i * 3] = palette[i][0] / 255;
          paletteBuffer[i * 3 + 1] = palette[i][1] / 255;
          paletteBuffer[i * 3 + 2] = palette[i][2] / 255;
        }
        context.useProgram(program);
        context.bindVertexArray(vao);
        context.uniform2f(loc.resolution, canvas.width, canvas.height);
        context.uniform1f(loc.cell, Math.max(1, Math.round(CELL_PX * dpr)));
        context.uniform1f(loc.time, elapsed);
        context.uniform1f(loc.dayProgress, state.dayProgress);
        context.uniform1f(loc.nightWeight, state.nightWeight);
        context.uniform2f(loc.dimCenter, state.dimCenter[0], state.dimCenter[1]);
        context.uniform2f(loc.dimRadius, state.dimRadius[0], state.dimRadius[1]);
        context.uniform1f(loc.dimStrength, state.dimStrength);
        context.uniform2f(loc.pointer, ptrX, ptrY);
        context.uniform1f(loc.pointerAlpha, ptrAlpha);
        context.uniform3fv(loc.palette, paletteBuffer);
        context.drawArrays(context.TRIANGLES, 0, 3);
      },
      destroy() {
        canvas.removeEventListener("webglcontextlost", handleLost);
        cleanup();
        if (!lost) {
          context.getExtension("WEBGL_lose_context")?.loseContext();
        }
      },
    };
  } catch {
    cleanup();
    return null;
  }
}

function createCanvas2dRenderer(canvas: HTMLCanvasElement): GlRenderer | null {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    return null;
  }

  let gridW = 1;
  let gridH = 1;
  let image = ctx.createImageData(1, 1);

  const stars = Array.from({ length: 90 }, (_, index) => ({
    x: hash2Cpu(index * 7, index * 13),
    y: hash2Cpu(index * 17, index * 3) * 0.82,
    bright: hash2Cpu(index * 29, index * 11) > 0.84,
    phase: hash2Cpu(index * 19, index * 5) * Math.PI * 2,
  }));

  return {
    resize(cssWidth, cssHeight) {
      gridW = Math.max(1, Math.ceil(cssWidth / CELL_PX));
      gridH = Math.max(1, Math.ceil(cssHeight / CELL_PX));
      canvas.width = gridW;
      canvas.height = gridH;
      image = ctx.createImageData(gridW, gridH);
    },
    draw(elapsed, state, palette, ptrX, ptrY, ptrAlpha) {
      const data = image.data;
      const aspect = gridW / Math.max(1, gridH);
      for (let y = 0; y < gridH; y++) {
        const ny = (y + 0.5) / gridH;
        for (let x = 0; x < gridW; x++) {
          const nx = (x + 0.5) / gridW;
          const lum = sampleLuminanceCpu(nx, ny, elapsed, state, ptrX, ptrY, ptrAlpha, aspect);
          const bayer = BAYER_4X4[(y & 3) * 4 + (x & 3)];
          const scaled = lum * 4;
          const lo = Math.floor(scaled);
          const idx = Math.min(4, lo + (scaled - lo > bayer ? 1 : 0));
          const rgb = palette[idx];
          const p = (y * gridW + x) * 4;
          data[p] = rgb[0];
          data[p + 1] = rgb[1];
          data[p + 2] = rgb[2];
          data[p + 3] = 255;
        }
      }

      if (state.nightWeight > 0.25) {
        const starRgb = palette[4];
        for (const star of stars) {
          const twinkle = 0.45 + 0.55 * Math.sin(elapsed * 1.9 + star.phase);
          if (twinkle * state.nightWeight < 0.35) {
            continue;
          }
          const sx = Math.floor(star.x * gridW);
          const sy = Math.floor(star.y * gridH);
          const put = (qx: number, qy: number, mix: number) => {
            if (qx < 0 || qx >= gridW || qy < 0 || qy >= gridH) {
              return;
            }
            const p = (qy * gridW + qx) * 4;
            data[p] = Math.round(lerp(data[p], starRgb[0], mix));
            data[p + 1] = Math.round(lerp(data[p + 1], starRgb[1], mix));
            data[p + 2] = Math.round(lerp(data[p + 2], starRgb[2], mix));
          };
          put(sx, sy, state.nightWeight * twinkle);
          if (star.bright && twinkle > 0.7) {
            put(sx - 1, sy, state.nightWeight * 0.45);
            put(sx + 1, sy, state.nightWeight * 0.45);
            put(sx, sy - 1, state.nightWeight * 0.45);
            put(sx, sy + 1, state.nightWeight * 0.45);
          }
        }
      }

      ctx.putImageData(image, 0, 0);
    },
    destroy() {},
  };
}

interface Bird {
  x: number;
  y: number;
  speed: number;
  phase: number;
}

export function createForestSkyBackdrop(
  skyCanvas: HTMLCanvasElement,
  lifeCanvas: HTMLCanvasElement,
  initiallyPaused: boolean,
): ForestSkyBackdrop | null {
  const root = document.documentElement;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const narrowScreen = matchMedia("(max-width: 47.999rem)");
  const events = new AbortController();

  let renderer: GlRenderer | null = null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let dark = root.dataset.theme === "dark";
  let progress = 0;
  let paused = initiallyPaused;
  let visible = true;
  let elapsed = 0;
  let lastNow = 0;
  let frame = 0;

  let ptrX = 0.56;
  let ptrY = 0.36;
  let ptrTargetAlpha = 0;
  let ptrAlpha = 0;

  const lifeCtx = lifeCanvas.getContext("2d");
  const birds: Bird[] = Array.from({ length: 6 }, (_, index) => ({
    x: 0.48 + index * 0.06,
    y: 0.13 + (index % 3) * 0.048,
    speed: 0.017 + (index % 3) * 0.0045,
    phase: index * 1.15,
  }));

  function fallbackTo2d() {
    renderer?.destroy();
    renderer = createCanvas2dRenderer(skyCanvas);
    if (renderer && width > 0 && height > 0) {
      renderer.resize(width, height, dpr);
      draw();
    }
  }

  renderer = createGlRenderer(skyCanvas, fallbackTo2d) ?? createCanvas2dRenderer(skyCanvas);
  if (!renderer) {
    return null;
  }

  function drawLife(state: SkySceneState, palette: SkyPalette) {
    if (!lifeCtx || width === 0 || height === 0) {
      return;
    }
    lifeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lifeCtx.clearRect(0, 0, width, height);

    // 白天与暮色的极简像素飞鸟，12fps 拍翼
    const birdAlpha = clamp01((0.55 - state.nightWeight) / 0.35);
    if (birdAlpha > 0.04 && !reducedMotion.matches) {
      const [r, g, b] = palette[0];
      lifeCtx.fillStyle = `rgb(${r} ${g} ${b} / ${birdAlpha * 0.78})`;
      const flapTick = Math.floor(elapsed * 12);
      for (const bird of birds) {
        const bx = Math.round((((bird.x + elapsed * bird.speed) % 1.16) - 0.08) * width);
        const by = Math.round((bird.y + Math.sin(elapsed * 1.2 + bird.phase) * 0.012) * height);
        const wing = Math.sin(flapTick * 0.65 + bird.phase) > 0 ? -CELL_PX : CELL_PX;
        const gx = Math.floor(bx / CELL_PX) * CELL_PX;
        const gy = Math.floor(by / CELL_PX) * CELL_PX;
        lifeCtx.fillRect(gx, gy, CELL_PX, CELL_PX);
        lifeCtx.fillRect(gx - CELL_PX, gy, CELL_PX, CELL_PX);
        lifeCtx.fillRect(gx + CELL_PX, gy, CELL_PX, CELL_PX);
        lifeCtx.fillRect(gx - CELL_PX * 2, gy + wing, CELL_PX, CELL_PX);
        lifeCtx.fillRect(gx + CELL_PX * 2, gy + wing, CELL_PX, CELL_PX);
      }
    }

    // 桌面端鼠标指针 ASCII 字符透镜
    if (ptrAlpha > 0.04 && finePointer.matches && !reducedMotion.matches) {
      const cx = ptrX * width;
      const cy = ptrY * height;
      const aspect = width / Math.max(1, height);
      const isNight = state.nightWeight > 0.5;

      lifeCtx.save();
      lifeCtx.globalAlpha = ptrAlpha;
      lifeCtx.beginPath();
      lifeCtx.arc(cx, cy, LENS_RADIUS, 0, Math.PI * 2);
      lifeCtx.clip();

      lifeCtx.fillStyle = isNight ? "rgb(11 16 14 / 0.72)" : "rgb(248 250 249 / 0.72)";
      lifeCtx.fillRect(cx - LENS_RADIUS, cy - LENS_RADIUS, LENS_RADIUS * 2, LENS_RADIUS * 2);

      lifeCtx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      lifeCtx.textAlign = "center";
      lifeCtx.textBaseline = "middle";
      lifeCtx.fillStyle = isNight ? "rgb(172 204 190 / 0.9)" : "rgb(66 99 86 / 0.88)";

      const stepX = 11;
      const stepY = 13;
      const startX = Math.floor((cx - LENS_RADIUS) / stepX) * stepX;
      const startY = Math.floor((cy - LENS_RADIUS) / stepY) * stepY;
      for (let sy = startY; sy <= cy + LENS_RADIUS; sy += stepY) {
        for (let sx = startX; sx <= cx + LENS_RADIUS; sx += stepX) {
          const lum = sampleLuminanceCpu(
            sx / width,
            sy / height,
            elapsed,
            state,
            ptrX,
            ptrY,
            ptrAlpha,
            aspect,
          );
          const tone = isNight ? lum : 1 - lum;
          const glyphIdx = Math.min(ASCII_RAMP.length - 1, Math.floor(tone * ASCII_RAMP.length));
          const ch = ASCII_RAMP[glyphIdx];
          if (ch !== " ") {
            lifeCtx.fillText(ch, sx, sy);
          }
        }
      }
      lifeCtx.restore();

      lifeCtx.save();
      lifeCtx.globalAlpha = ptrAlpha * 0.9;
      lifeCtx.beginPath();
      lifeCtx.arc(cx, cy, LENS_RADIUS, 0, Math.PI * 2);
      lifeCtx.strokeStyle = isNight ? "rgb(188 212 200 / 0.24)" : "rgb(66 99 86 / 0.2)";
      lifeCtx.lineWidth = 1;
      lifeCtx.stroke();
      lifeCtx.restore();
    }
  }

  function draw() {
    if (!renderer || width === 0 || height === 0) {
      return;
    }
    const state = computeSkySceneState(progress, dark, narrowScreen.matches);
    const palette = resolveSkyPalette(state);
    renderer.draw(elapsed, state, palette, ptrX, ptrY, ptrAlpha);
    drawLife(state, palette);
  }

  function tick(now: number) {
    const dt = Math.min(0.08, (now - lastNow) / 1000);
    lastNow = now;
    elapsed += dt;
    ptrAlpha += (ptrTargetAlpha - ptrAlpha) * Math.min(1, dt * 8);
    if (ptrAlpha < 0.005 && ptrTargetAlpha === 0) {
      ptrAlpha = 0;
    }
    draw();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    const running = !paused && !reducedMotion.matches && visible && !document.hidden;
    if (running && !frame) {
      lastNow = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (!running && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function resize() {
    width = skyCanvas.clientWidth;
    height = skyCanvas.clientHeight;
    dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    if (width === 0 || height === 0) {
      return;
    }
    renderer?.resize(width, height, dpr);
    lifeCanvas.width = Math.round(width * dpr);
    lifeCanvas.height = Math.round(height * dpr);
    draw();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(skyCanvas);
  const visibility = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    sync();
  });
  visibility.observe(skyCanvas);
  const themeObserver = new MutationObserver(() => {
    dark = root.dataset.theme === "dark";
    if (!frame) {
      draw();
    }
  });
  themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("visibilitychange", sync, { signal: events.signal });
  reducedMotion.addEventListener(
    "change",
    () => {
      sync();
      if (!frame) {
        draw();
      }
    },
    { signal: events.signal },
  );

  resize();
  sync();

  return {
    setProgress(next) {
      if (Math.abs(next - progress) < 0.0005) {
        return;
      }
      progress = next;
      if (!frame) {
        draw();
      }
    },
    setPaused(next) {
      paused = next;
      sync();
    },
    setPointer(x, y, active) {
      ptrX = clamp01(x);
      ptrY = clamp01(y);
      ptrTargetAlpha = active ? 1 : 0;
    },
    destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
      events.abort();
      resizeObserver.disconnect();
      visibility.disconnect();
      themeObserver.disconnect();
      renderer?.destroy();
      renderer = null;
    },
  };
}
