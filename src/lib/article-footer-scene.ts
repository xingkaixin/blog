import lineDesktopAvif from "@/assets/footer/article-line-desktop.avif?url";
import lineDesktopWebp from "@/assets/footer/article-line-desktop.webp?url";
import lineMobileAvif from "@/assets/footer/article-line-mobile.avif?url";
import lineMobileWebp from "@/assets/footer/article-line-mobile.webp?url";
import washDesktopAvif from "@/assets/footer/article-wash-desktop.avif?url";
import washDesktopWebp from "@/assets/footer/article-wash-desktop.webp?url";
import washMobileAvif from "@/assets/footer/article-wash-mobile.avif?url";
import washMobileWebp from "@/assets/footer/article-wash-mobile.webp?url";

export interface ArticleFooterHandle {
  /** 触发一次 2.7s 线稿→水彩显影动画（幂等） */
  triggerReveal(): void;
  /** 可见性切换：离屏停跑，回屏继续低帧率流云 */
  setVisible(visible: boolean): void;
  /** 释放动画帧、监听与 WebGL 资源 */
  destroy(): void;
}

type RGB = [number, number, number];

type Palette = {
  paper: RGB;
  ink: RGB;
  mist: RGB;
  sky: RGB;
};

type ProgramSet = {
  main: WebGLProgram;
  uMain: Record<string, WebGLUniformLocation | null>;
  air: WebGLProgram;
  uAir: Record<string, WebGLUniformLocation | null>;
};

const DURATION = 2.7;
const AIR_RATES = [15, 20, 30] as const;
const AIR_STEP = 0.75;
const TEX_ASPECT = 1536 / 427;
const WORLD_H = 180;
const WIND_PX_PER_SEC = 14;
const SHADOW_STRENGTH = 0.42;
const SUN_STRENGTH = 0.22;
const MIST_STRENGTH = 0.56;
const LOOSE_WASH = 0.44;
// 水面、栈桥与树冠三处高度带（y01：0 为顶、1 为底）
const MIST_BANDS = new Float32Array([0.74, 0.58, 0.34, -2.0]);
const PERIODS = [90, 90, 140, 140] as const;
const SHIFTS = [0, 0.5, 0, 0.5] as const;

const AVIF_PROBE_URI =
  "data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAAB0AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAlbWRhdBIACgc4AAaQENBpMhAZQmMEwAA0AACQQM6Xt10S";

let avifSupportPromise: Promise<boolean> | null = null;

function supportsAvif(): Promise<boolean> {
  if (!avifSupportPromise) {
    avifSupportPromise = new Promise((resolve) => {
      const img = new Image();
      img.addEventListener(
        "load",
        () => resolve(img.naturalWidth === 1 && img.naturalHeight === 1),
        {
          once: true,
        },
      );
      img.addEventListener("error", () => resolve(false), { once: true });
      img.src = AVIF_PROBE_URI;
    });
  }
  return avifSupportPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.addEventListener("load", () => resolve(img), { once: true });
    img.addEventListener(
      "error",
      () => reject(new Error(`Failed to load footer texture: ${src}`)),
      {
        once: true,
      },
    );
    img.src = src;
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(lo: number, hi: number, x: number): number {
  const u = clamp((x - lo) / (hi - lo), 0, 1);
  return u * u * (3 - 2 * u);
}

function parseCssColor(raw: string, fallback: RGB): RGB {
  const value = raw.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 6) {
      const n = parseInt(hex, 16);
      if (!Number.isNaN(n)) {
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      }
    }
  }
  const rgbMatch = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/.exec(value);
  if (rgbMatch) {
    return [Number(rgbMatch[1]) / 255, Number(rgbMatch[2]) / 255, Number(rgbMatch[3]) / 255];
  }
  return fallback;
}

function readThemeState(canvas: HTMLCanvasElement): { dark: boolean; palette: Palette } {
  const dark = document.documentElement.dataset.theme === "dark";
  const cs = getComputedStyle(canvas);
  const paper = parseCssColor(
    cs.getPropertyValue("--ink-50"),
    dark ? [26 / 255, 31 / 255, 29 / 255] : [244 / 255, 246 / 255, 245 / 255],
  );
  const ink = parseCssColor(
    cs.getPropertyValue("--ink-700"),
    dark ? [211 / 255, 216 / 255, 214 / 255] : [38 / 255, 43 / 255, 41 / 255],
  );
  const mist: RGB = dark ? [78 / 255, 114 / 255, 102 / 255] : [242 / 255, 246 / 255, 244 / 255];
  const sky: RGB = dark ? [0.18, 0.36, 0.32] : [0.76, 0.84, 0.81];
  return { dark, palette: { paper, ink, mist, sky } };
}

const VERTEX_SRC = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const COMMON_GLSL = (night: boolean) => `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform vec2 u_res;
  uniform float u_scale;
  uniform vec3 u_paper, u_mist;
  uniform vec4 u_amb, u_off, u_mistY;
  uniform vec2 u_mix;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    return 0.5 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.2 * vnoise(p * 4.1 + 3.3);
  }
  float drifting(vec2 p, float a, float b, float w, float size) {
    float na = fbm(vec2(p.x - a, p.y) / size);
    float nb = fbm(vec2(p.x - b, p.y) / size + vec2(17.3, 9.1));
    return (mix(na, nb, w) - 0.5) / sqrt(w * w + (1.0 - w) * (1.0 - w)) + 0.5;
  }
  float bandMask(float y01, float at) {
    if (at < -0.5) return 0.0;
    float d = (y01 - at) / 0.105;
    return exp(-d * d);
  }
  vec3 ambient(vec3 color, vec2 wp, float y01${night ? ", float open" : ""}) {
    if (u_amb.x <= 0.001) return color;
    vec3 d = color - u_paper;
    float paint = smoothstep(0.012, 0.085, length(d));
    float c = drifting(vec2(wp.x, wp.y * 1.55), u_off.x, u_off.y, u_mix.x, 175.0);
    float shade = smoothstep(0.47, 0.61, c) * u_amb.y - (1.0 - smoothstep(0.35, 0.46, c)) * u_amb.w;
    float band = min(1.0, bandMask(y01, u_mistY.x) + bandMask(y01, u_mistY.y) + bandMask(y01, u_mistY.z) + bandMask(y01, u_mistY.w));
    float m = band * smoothstep(0.44, 0.65, drifting(vec2(wp.x, wp.y * 5.2), u_off.z, u_off.w, u_mix.y, 145.0)) * u_amb.z * u_amb.x;
    vec3 lit = u_paper + d * (1.0 + shade * u_amb.x);
    ${
      night
        ? `
    vec3 hazed = u_paper + (lit - u_paper) * (1.0 - 0.45 * m);
    return clamp(mix(color, hazed, paint) + (u_mist - u_paper) * m * open * open, 0.0, 1.0);
    `
        : `
    lit = mix(lit, lit * vec3(0.84, 0.89, 0.94), paint * max(shade, 0.0) * u_amb.x);
    lit = mix(lit, lit * vec3(1.04, 1.02, 0.96), paint * max(-shade, 0.0) * u_amb.x);
    vec3 hazed = u_paper + (lit - u_paper) * (1.0 - 0.82 * m);
    return clamp(mix(color, hazed, paint), 0.0, 1.0);
    `
    }
  }
`;

const NIGHT_LIGHT_GLSL = `
  vec3 lightLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 lightGamma(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  vec3 oklab(vec3 c) {
    vec3 r = lightLinear(clamp(c, 0.0, 1.0));
    vec3 lms = pow(max(vec3(
      dot(r, vec3(0.4122214708, 0.5363325363, 0.0514459929)),
      dot(r, vec3(0.2119034982, 0.6806995451, 0.1073969566)),
      dot(r, vec3(0.0883024619, 0.2817188376, 0.6299787005))), 0.0), vec3(1.0 / 3.0));
    return vec3(
      dot(lms, vec3(0.2104542553, 0.7936177850, -0.0040720468)),
      dot(lms, vec3(1.9779984951, -2.4285922050, 0.4505937099)),
      dot(lms, vec3(0.0259040371, 0.7827717662, -0.8086757660)));
  }
  vec3 oklabLinear(vec3 v) {
    vec3 lms = vec3(
      v.x + 0.3963377774 * v.y + 0.2158037573 * v.z,
      v.x - 0.1055613458 * v.y - 0.0638541728 * v.z,
      v.x - 0.0894841775 * v.y - 1.2914855480 * v.z);
    lms = lms * lms * lms;
    return vec3(
      dot(lms, vec3(4.0767416621, -3.3077115913, 0.2309699292)),
      dot(lms, vec3(-1.2684380046, 2.6097574011, -0.3413193965)),
      dot(lms, vec3(-0.0041960863, -0.7034186147, 1.7076147010)));
  }
  vec3 glowPigment(vec3 pig) {
    vec3 v = oklab(pig);
    float C = length(v.yz);
    float h = C > 1e-5 ? atan(v.z, v.y) : 4.2;
    float L = mix(0.62, 0.80, smoothstep(0.25, 0.85, v.x));
    float C2 = min(0.15, C * 1.24 + 0.012);
    return lightGamma(clamp(oklabLinear(vec3(L, C2 * cos(h), C2 * sin(h))), 0.0, 1.0));
  }
  vec3 shine(vec3 ground, vec4 light) {
    vec3 g = oklab(ground);
    vec3 v = oklab(light.rgb);
    float s = clamp(v.x / 0.78, 0.0, 1.0);
    float t = s * sqrt(s);
    float L = min(0.84, pow(g.x * g.x * g.x + v.x * v.x * v.x, 1.0 / 3.0));
    float keep = (1.0 - t) * (1.0 - t);
    vec2 ab = g.yz * keep + v.yz * (1.05 * smoothstep(0.0, 0.85, s));
    return lightGamma(clamp(oklabLinear(vec3(L, ab)), 0.0, 1.0));
  }
`;

const AMBIENT_SRC = (night: boolean) =>
  COMMON_GLSL(night) +
  `
  uniform sampler2D u_cache;
  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 wp = vec2(frag.x - 0.5 * u_res.x, u_res.y - frag.y) / u_scale;
    float y01 = (u_res.y - frag.y) / u_res.y;
    vec4 settled = texture2D(u_cache, frag / u_res);
    ${
      night
        ? "gl_FragColor = vec4(ambient(settled.rgb, wp, y01, settled.a), 1.0);"
        : "gl_FragColor = vec4(ambient(settled.rgb, wp, y01), 1.0);"
    }
  }
`;

const MAIN_SRC = (night: boolean) =>
  COMMON_GLSL(night) +
  (night ? NIGHT_LIGHT_GLSL : "") +
  `
  uniform float u_t, u_loose, u_cached;
  uniform vec3 u_ink, u_sky;
  uniform sampler2D u_wash, u_line;

  vec2 artUV(vec2 uv) {
    float viewAspect = u_res.x / max(u_res.y, 1.0);
    float sx = viewAspect / ${TEX_ASPECT.toFixed(6)};
    float focusX = mix(0.68, 0.5, smoothstep(1.1, ${TEX_ASPECT.toFixed(6)}, viewAspect));
    float center = focusX;
    if (sx < 1.0) {
      float halfSpan = 0.5 * sx;
      center = clamp(focusX, halfSpan, 1.0 - halfSpan);
    }
    return vec2((uv.x - 0.5) * sx + center, uv.y);
  }

  vec4 sampleBounded(sampler2D tex, vec2 auv) {
    if (auv.x <= 0.0 || auv.x >= 1.0 || auv.y <= 0.0 || auv.y >= 1.0) return vec4(0.0);
    float edge = smoothstep(0.0, 0.025, auv.x) * smoothstep(1.0, 0.975, auv.x);
    return texture2D(tex, auv) * edge;
  }

  float toothAt(vec2 sp) {
    return 0.55 * vnoise(sp * 1.9) + 0.45 * vnoise(sp * 0.71 + 31.0);
  }

  float lineShown(vec2 uv, vec2 sp) {
    return smoothstep(0.0, 0.11, u_t * 2.45 - uv.x - 0.24 * vnoise(sp / 56.0));
  }

  float washShown(vec2 uv, vec2 sp) {
    return smoothstep(0.0, 0.30, (u_t - 0.18) * 2.15 - 0.52 * uv.x - 0.78 * fbm(sp / 108.0 + 5.0));
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / u_res;
    vec2 auv = artUV(uv);
    vec2 wp = vec2(frag.x - 0.5 * u_res.x, u_res.y - frag.y) / u_scale;
    vec2 sp = wp + vec2(311.0, 57.0);
    float y01 = (u_res.y - frag.y) / u_res.y;

    float tooth = toothAt(sp);
    float blot = fbm(sp / 44.0);
    float ml = lineShown(uv, sp);
    float mw = washShown(uv, sp);

    vec3 color = u_paper;

    // 极轻的天空水雾，只在右上侧淡入，保持左上角文字区干净透气
    float rightBias = smoothstep(0.18, 0.65, uv.x);
    float skyFade = (1.0 - smoothstep(0.0, 0.52, y01 + (blot - 0.5) * 0.12)) * mw * rightBias;
    float cloudGap = smoothstep(0.36, 0.68, fbm(sp / 92.0 + vec2(12.0, 4.0)));
    float skyAmt = skyFade * (0.06 + 0.05 * cloudGap) * (0.85 + 0.3 * tooth);
    ${
      night
        ? "color = shine(color, vec4(u_sky * skyAmt * 1.15, skyAmt));"
        : "color = mix(color, color * mix(vec3(1.0), u_sky, 0.85), skyAmt);"
    }

    // 水彩层：微扰坐标 + 6 向邻域采样边缘积色（rim）+ 湿润前沿加深
    vec2 px = vec2(u_scale / u_res.x * (u_res.x / max(u_res.y, 1.0)) / ${TEX_ASPECT.toFixed(6)}, u_scale / max(u_res.y, 1.0));
    vec2 warp = (vec2(fbm(sp / 26.0), fbm(sp / 26.0 + vec2(41.0, 17.0))) - 0.5) * (0.9 + 2.6 * u_loose)
              + (vec2(vnoise(sp / 4.2), vnoise(sp / 4.2 + 9.0)) - 0.5) * (0.35 + 0.55 * u_loose);
    vec2 wuv = auv + warp * px * vec2(1.0, -1.0);

    vec4 c0 = sampleBounded(u_wash, wuv) * mw;
    vec4 nearS = vec4(0.0), farS = vec4(0.0);
    float reach = 2.0 + 3.2 * u_loose;
    for (int i = 0; i < 6; i++) {
      float a = 1.0471975 * float(i) + 0.3;
      vec2 dir = vec2(cos(a), sin(a));
      nearS += sampleBounded(u_wash, wuv + dir * 1.3 * px) * mw;
      farS  += sampleBounded(u_wash, wuv + vec2(dir.y, -dir.x) * reach * px) * mw;
    }
    nearS /= 6.0;
    farS  /= 6.0;

    vec4 c = mix(c0, farS, 0.14 + 0.22 * u_loose);
    float rim = max(c0.a - nearS.a, 0.0) * 1.55 + max(c0.a - farS.a, 0.0) * 0.7;
    float wetFrontier = 1.0 + 0.52 * mw * (1.0 - mw) * 4.0;

    ${
      night
        ? `
    vec3 pigRaw = c.rgb / max(c.a, 0.001);
    vec3 glowCol = glowPigment(pigRaw);
    float gain = c.a * (1.0 + rim / (c0.a + 0.12)) * (0.86 + 0.28 * blot) * wetFrontier * (0.94 + 0.18 * tooth);
    color = shine(color, vec4(min(glowCol * gain * 1.12, vec3(1.0)), clamp(c.a * 1.1, 0.0, 1.0)));
    `
        : `
    float dens = c.a * (1.0 + rim / (c0.a + 0.12));
    dens *= (0.85 + 0.30 * blot);
    dens *= (1.0 + (0.36 + 0.22 * u_loose) * (tooth - 0.5));
    dens *= wetFrontier;
    dens = clamp(dens, 0.0, 1.32);
    vec3 pig = c.rgb / max(c.a, 0.001);
    color *= pow(max(pig, vec3(0.04)), vec3(dens));
    `
    }

    // 单通道灰度线稿（.r = 墨水浓度），叠加冷压纸纹颗粒
    float lineIntensity = sampleBounded(u_line, auv).r * ml;
    float grain = vnoise(sp * 2.5 + 11.0);
    float pa = clamp(lineIntensity * (0.64 + 0.68 * smoothstep(0.18, 0.80, 0.55 * grain + 0.45 * tooth)), 0.0, 1.0);
    ${night ? "color = mix(color, u_ink, pa * 0.78);" : "color *= 1.0 - pa * (1.0 - u_ink);"}

    float fade = 1.0 - smoothstep(0.93, 0.998, y01 + (blot - 0.5) * 0.025);
    vec3 finalCol = mix(u_paper, color, fade);

    ${
      night
        ? "gl_FragColor = vec4(ambient(finalCol, wp, y01, fade), mix(1.0, fade, u_cached));"
        : "gl_FragColor = vec4(ambient(finalCol, wp, y01), 1.0);"
    }
  }
`;

const AIR_NAMES = ["res", "scale", "paper", "mist", "amb", "off", "mix", "mistY"] as const;
const MAIN_NAMES = [...AIR_NAMES, "t", "loose", "cached", "ink", "sky", "wash", "line"] as const;

export function mountArticleFooterScene(
  canvas: HTMLCanvasElement,
  animate: boolean,
): ArticleFooterHandle {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });

  let destroyed = false;
  let visible = false;
  let revealed = !animate;
  let ready = false;
  let t = animate ? 0 : 1;
  let start: number | null = null;
  let airSince: number | null = null;
  let cacheValid = false;
  let rafId = 0;
  let timerId = 0;
  let themeState = readThemeState(canvas);
  let loadedLine: HTMLImageElement | null = null;
  let loadedWash: HTMLImageElement | null = null;
  let fallbackLineCanvas: HTMLCanvasElement | null = null;
  let contextLost = false;

  const drift = {
    at: null as number | null,
    phase: [0, 0, 0, 0],
    off: [0, 0, 0, 0],
  };

  let quadBuffer: WebGLBuffer | null = null;
  const programs: Partial<Record<"day" | "night", ProgramSet>> = {};
  let washTex: WebGLTexture | null = null;
  let lineTex: WebGLTexture | null = null;
  let cache: {
    tex: WebGLTexture;
    fbo: WebGLFramebuffer;
    w: number;
    h: number;
    ok: boolean;
  } | null = null;

  function compileProgram(vSrc: string, fSrc: string): WebGLProgram | null {
    if (!gl) {
      return null;
    }
    const prog = gl.createProgram();
    const shaders: WebGLShader[] = [];
    try {
      for (const [type, src] of [
        [gl.VERTEX_SHADER, vSrc],
        [gl.FRAGMENT_SHADER, fSrc],
      ] as const) {
        const shader = gl.createShader(type);
        if (!shader) {
          throw new Error("createShader failed");
        }
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || "shader compile error");
        }
        gl.attachShader(prog, shader);
        shaders.push(shader);
      }
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) || "program link error");
      }
      return prog;
    } catch {
      gl.deleteProgram(prog);
      return null;
    } finally {
      for (const shader of shaders) {
        gl.deleteShader(shader);
      }
    }
  }

  function getUniforms(
    prog: WebGLProgram,
    names: readonly string[],
  ): Record<string, WebGLUniformLocation | null> {
    const map: Record<string, WebGLUniformLocation | null> = {};
    if (!gl) {
      return map;
    }
    for (const name of names) {
      map[name] = gl.getUniformLocation(prog, `u_${name}`);
    }
    return map;
  }

  function bindQuad(prog: WebGLProgram) {
    if (!gl || !quadBuffer) {
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const loc = gl.getAttribLocation(prog, "a_position");
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
  }

  function getProgramSet(): ProgramSet | null {
    if (!gl) {
      return null;
    }
    const key = themeState.dark ? "night" : "day";
    const existing = programs[key];
    if (existing) {
      return existing;
    }
    const main = compileProgram(VERTEX_SRC, MAIN_SRC(themeState.dark));
    const air = compileProgram(VERTEX_SRC, AMBIENT_SRC(themeState.dark));
    if (!main || !air) {
      if (main) {
        gl.deleteProgram(main);
      }
      if (air) {
        gl.deleteProgram(air);
      }
      return null;
    }
    const set: ProgramSet = {
      main,
      uMain: getUniforms(main, MAIN_NAMES),
      air,
      uAir: getUniforms(air, [...AIR_NAMES, "cache"]),
    };
    programs[key] = set;
    return set;
  }

  function uploadTexture(
    tex: WebGLTexture,
    img: HTMLImageElement,
    premultiplyAlpha: boolean,
  ): void {
    if (!gl) {
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function ensureCache(): boolean {
    if (!gl) {
      return false;
    }
    const w = canvas.width;
    const h = canvas.height;
    if (cache && cache.w === w && cache.h === h) {
      return cache.ok;
    }
    if (!cache) {
      cache = {
        tex: gl.createTexture(),
        fbo: gl.createFramebuffer(),
        w: 0,
        h: 0,
        ok: false,
      };
    }
    gl.bindTexture(gl.TEXTURE_2D, cache.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cache.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cache.tex, 0);
    cache.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    cache.w = w;
    cache.h = h;
    cacheValid = false;
    return cache.ok;
  }

  if (gl) {
    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    washTex = gl.createTexture();
    lineTex = gl.createTexture();
  }

  function stepDrift(now: number): [number, number] {
    const dt = drift.at === null ? 0 : clamp(now - drift.at, 0, 0.5);
    drift.at = now;
    const wCloud = WIND_PX_PER_SEC;
    const wMist = WIND_PX_PER_SEC * 0.62;
    const speeds = [wCloud, wCloud, wMist, wMist] as const;
    for (let i = 0; i < 4; i++) {
      const phase = (now / PERIODS[i] + SHIFTS[i]) % 1;
      if (phase < drift.phase[i]) {
        drift.off[i] = speeds[i] * phase * PERIODS[i];
      } else {
        drift.off[i] = drift.off[i] + speeds[i] * dt;
      }
      drift.phase[i] = phase;
    }
    return [Math.abs(2 * drift.phase[0] - 1), Math.abs(2 * drift.phase[2] - 1)];
  }

  function setAirUniforms(
    u: Record<string, WebGLUniformLocation | null>,
    strength: number,
    mixVals: [number, number],
  ) {
    if (!gl) {
      return;
    }
    const { dark, palette } = themeState;
    const sign = dark ? -0.78 : 1.0;
    gl.uniform3fv(u.paper, palette.paper);
    gl.uniform3fv(u.mist, palette.mist);
    gl.uniform4f(u.amb, strength, SHADOW_STRENGTH * sign, MIST_STRENGTH, SUN_STRENGTH * sign);
    gl.uniform4f(u.off, drift.off[0], drift.off[1], drift.off[2], drift.off[3]);
    gl.uniform2f(u.mix, mixVals[0], mixVals[1]);
    gl.uniform4fv(u.mistY, MIST_BANDS);
  }

  function drawMainPass(
    set: ProgramSet,
    strength: number,
    mixVals: [number, number],
    cached: boolean,
  ) {
    if (!gl || !washTex || !lineTex) {
      return;
    }
    const { palette } = themeState;
    const u = set.uMain;
    gl.useProgram(set.main);
    bindQuad(set.main);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.scale, canvas.height / WORLD_H);
    setAirUniforms(u, strength, mixVals);
    gl.uniform1f(u.t, t);
    gl.uniform1f(u.loose, LOOSE_WASH);
    gl.uniform1f(u.cached, cached ? 1.0 : 0.0);
    gl.uniform3fv(u.ink, palette.ink);
    gl.uniform3fv(u.sky, palette.sky);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, washTex);
    gl.uniform1i(u.wash, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lineTex);
    gl.uniform1i(u.line, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function clearPaper() {
    const [r, g, b] = themeState.palette.paper;
    if (gl && !contextLost) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(r, g, b, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function buildFallbackLine(img: HTMLImageElement): HTMLCanvasElement {
    const off = document.createElement("canvas");
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const ctx = off.getContext("2d");
    if (!ctx) {
      return off;
    }
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, off.width, off.height);
    const [ir, ig, ib] = themeState.palette.ink.map((c) => Math.round(c * 255));
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const alpha = px[i];
      px[i] = ir;
      px[i + 1] = ig;
      px[i + 2] = ib;
      px[i + 3] = alpha;
    }
    ctx.putImageData(data, 0, 0);
    return off;
  }

  function renderFallback2D() {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    clearPaper();
    if (!loadedWash || !loadedLine || t <= 0) {
      return;
    }
    if (!fallbackLineCanvas) {
      fallbackLineCanvas = buildFallbackLine(loadedLine);
    }
    const w = canvas.width;
    const h = canvas.height;
    const drawW = h * TEX_ASPECT;
    const viewAspect = w / Math.max(h, 1);
    const focusX = 0.68 + (0.5 - 0.68) * smoothstep(1.1, TEX_ASPECT, viewAspect);
    const sx = viewAspect / TEX_ASPECT;
    const ox = sx < 1 ? clamp(w * 0.5 - drawW * focusX, w - drawW, 0) : (w - drawW) * 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w * clamp(t * 1.4, 0, 1), h);
    ctx.clip();
    ctx.globalAlpha = clamp((t - 0.18) / 0.82, 0, 1);
    ctx.drawImage(loadedWash, ox, 0, drawW, h);
    ctx.globalAlpha = clamp(t * 2.2, 0, 1);
    ctx.drawImage(fallbackLineCanvas, ox, 0, drawW, h);
    ctx.restore();
  }

  function renderFrame(now: number) {
    if (destroyed || canvas.width <= 0 || canvas.height <= 0) {
      return;
    }
    if (!ready || (!revealed && animate)) {
      clearPaper();
      return;
    }
    if (!gl || contextLost) {
      renderFallback2D();
      return;
    }
    const set = getProgramSet();
    if (!set) {
      renderFallback2D();
      return;
    }

    const mixVals = stepDrift(now);
    const airStrength =
      animate && t >= 1 && airSince !== null ? smoothstep(0, 2.2, now - airSince) : 0;

    if (animate && t >= 1 && airStrength > 0 && ensureCache() && cache) {
      if (!cacheValid) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, cache.fbo);
        drawMainPass(set, 0, mixVals, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        cacheValid = true;
      }
      const u = set.uAir;
      gl.useProgram(set.air);
      bindQuad(set.air);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.scale, canvas.height / WORLD_H);
      setAirUniforms(u, airStrength, mixVals);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cache.tex);
      gl.uniform1i(u.cache, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }

    cacheValid = false;
    drawMainPass(set, airStrength, mixVals, false);
  }

  function airRate(): number {
    const cssSpeed = Math.abs(WIND_PX_PER_SEC) * (canvas.clientHeight / WORLD_H);
    if (cssSpeed < 0.01) {
      return AIR_RATES[0];
    }
    for (const fps of AIR_RATES) {
      if (cssSpeed / fps <= AIR_STEP) {
        return fps;
      }
    }
    return AIR_RATES[AIR_RATES.length - 1];
  }

  function cancelScheduled() {
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = 0;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function wake() {
    if (destroyed) {
      return;
    }
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = 0;
    }
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function tick(ms: number) {
    rafId = 0;
    if (destroyed) {
      return;
    }
    const now = ms / 1000;

    if (!ready) {
      clearPaper();
      return;
    }

    if (!animate) {
      t = 1;
      renderFrame(now);
      return;
    }

    if (!revealed) {
      clearPaper();
      return;
    }

    if (!visible || document.hidden) {
      return;
    }

    if (t < 1) {
      if (start === null) {
        start = now;
      }
      t = clamp((now - start) / DURATION, 0, 1);
      if (t >= 1) {
        airSince = now;
      }
    } else if (airSince === null) {
      airSince = now;
    }

    renderFrame(now);

    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      const interval = 1 / airRate();
      timerId = window.setTimeout(
        () => {
          timerId = 0;
          if (!destroyed && visible && !document.hidden && !rafId) {
            rafId = requestAnimationFrame(tick);
          }
        },
        Math.max(0, interval * 1000 - 8),
      );
    }
  }

  function resize() {
    if (destroyed) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(0, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(0, Math.round(canvas.clientHeight * dpr));
    if (!w || !h) {
      return;
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      cacheValid = false;
      wake();
    }
  }

  function onThemeChange() {
    if (destroyed) {
      return;
    }
    themeState = readThemeState(canvas);
    fallbackLineCanvas = null;
    cacheValid = false;
    wake();
  }

  function onVisibilityChange() {
    if (destroyed) {
      return;
    }
    if (document.hidden) {
      cancelScheduled();
    } else if (visible && revealed) {
      drift.at = null;
      wake();
    }
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    cacheValid = false;
    cancelScheduled();
    renderFallback2D();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const themeObserver = new MutationObserver(onThemeChange);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("webglcontextlost", onContextLost);

  resize();
  clearPaper();

  // 按设备尺寸与 AVIF 能力选择最小的一组压缩纹理（桌面 ~72KB / 移动 ~36KB）
  void supportsAvif()
    .then(async (useAvif) => {
      if (destroyed) {
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const useMobile = canvas.clientWidth > 0 && canvas.clientWidth * dpr <= 900;
      const lineSrc = useMobile
        ? useAvif
          ? lineMobileAvif
          : lineMobileWebp
        : useAvif
          ? lineDesktopAvif
          : lineDesktopWebp;
      const washSrc = useMobile
        ? useAvif
          ? washMobileAvif
          : washMobileWebp
        : useAvif
          ? washDesktopAvif
          : washDesktopWebp;

      const [lineImg, washImg] = await Promise.all([loadImage(lineSrc), loadImage(washSrc)]);
      if (destroyed) {
        return;
      }
      loadedLine = lineImg;
      loadedWash = washImg;
      if (gl && !contextLost && lineTex && washTex) {
        uploadTexture(lineTex, lineImg, false);
        uploadTexture(washTex, washImg, true);
      }
      ready = true;
      cacheValid = false;
      wake();
    })
    .catch(() => {
      // 图片拉取失败时保留纸面底色，不影响页脚文案与操作
    });

  return {
    triggerReveal() {
      if (destroyed || revealed) {
        return;
      }
      revealed = true;
      if (animate) {
        start = null;
      } else {
        t = 1;
      }
      wake();
    },
    setVisible(nextVisible: boolean) {
      if (destroyed || visible === nextVisible) {
        return;
      }
      visible = nextVisible;
      if (!visible) {
        cancelScheduled();
      } else {
        drift.at = null;
        wake();
      }
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      cancelScheduled();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      if (gl && !contextLost) {
        if (washTex) {
          gl.deleteTexture(washTex);
        }
        if (lineTex) {
          gl.deleteTexture(lineTex);
        }
        if (cache) {
          gl.deleteTexture(cache.tex);
          gl.deleteFramebuffer(cache.fbo);
        }
        if (quadBuffer) {
          gl.deleteBuffer(quadBuffer);
        }
        for (const set of Object.values(programs)) {
          if (set) {
            gl.deleteProgram(set.main);
            gl.deleteProgram(set.air);
          }
        }
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    },
  };
}
