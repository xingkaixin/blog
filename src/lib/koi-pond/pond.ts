/**
 * 锦鲤池的 WebGL2 管线：
 *   1. 波动方程仿真涟漪高度场（定步长，与帧率解耦）
 *   2. 渲染水下的池底与锦鲤
 *   3. 按水面法线折射、焦散与反射合成最终画面
 */

import { createKoiSchool, KOI_COUNT } from "./koi";
import { COMP_FS, SIM_FS, UNDER_FS, VS } from "./shaders";

export interface PondHandle {
  destroy(): void;
}

export type PondResult = { ok: true; pond: PondHandle } | { ok: false; reason: string };

export interface PondOptions {
  /** false 时只渲染一帧静止水面：不自动落雨、不响应指针。用于 prefers-reduced-motion。 */
  animated: boolean;
  /** 首次由指针触发涟漪时回调一次，用于收起操作提示。 */
  onFirstDrop?: () => void;
}

/** 仿真网格，3:1 让格子接近正方形 */
const SIM_W = 1024;
const SIM_H = 342;
const WORLD_W = 3.0;
const CELL_W = WORLD_W / SIM_W;

const SIM_DT = 1 / 120;
const SIM_DAMP = 0.99905;
/** x = c0²（长波相速平方），y = 色散权重，z = 非线性系数（1/静水深），w = 宽算子半径（纹素） */
const PHYS = [0.46, 0.6, 3.0, 14.0] as const;
/** x = 环境波幅，y = 涟漪权重，z = 折射，w = 焦散 */
const TUNE = [0.015, 0.036, 0.175, 0.1] as const;
/** x = 反射，y = 高光，z = 浮萍 */
const TUNE2 = [1.0, 1.0, 1.0] as const;

const MAX_DROPS = 12;
/** 单帧渲染像素上限，超过则等比缩小，避免高 DPR 大屏上一帧就吃满 GPU */
const MAX_VIEW_PIXELS = 2.9e6;

export function createPond(canvas: HTMLCanvasElement, options: PondOptions): PondResult {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) {
    return { ok: false, reason: "当前浏览器不支持 WebGL2，无法运行这片水面。" };
  }
  if (
    !gl.getExtension("EXT_color_buffer_float") &&
    !gl.getExtension("EXT_color_buffer_half_float")
  ) {
    return { ok: false, reason: "当前设备不支持浮点渲染目标，无法运行波动仿真。" };
  }
  return buildPond(gl, canvas, options);
}

function buildPond(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  options: PondOptions,
): PondResult {
  /* --- GL 工具 --------------------------------------------------------- */

  function compile(type: number, src: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }

  interface Program {
    use(): void;
    u(name: string): WebGLUniformLocation | null;
    dispose(): void;
  }

  function createProgram(vsSrc: string, fsSrc: string): Program {
    const id = gl.createProgram();
    gl.attachShader(id, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(id, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.bindAttribLocation(id, 0, "aPos");
    gl.linkProgram(id);
    if (!gl.getProgramParameter(id, gl.LINK_STATUS)) {
      throw new Error(`link: ${gl.getProgramInfoLog(id)}`);
    }
    const cache = new Map<string, WebGLUniformLocation | null>();
    return {
      use: () => gl.useProgram(id),
      u(name) {
        if (!cache.has(name)) {
          cache.set(name, gl.getUniformLocation(id, name));
        }
        return cache.get(name) ?? null;
      },
      dispose: () => gl.deleteProgram(id),
    };
  }

  interface Target {
    tex: WebGLTexture;
    fb: WebGLFramebuffer;
    w: number;
    h: number;
  }

  function createTarget(
    w: number,
    h: number,
    internal: number,
    format: number,
    type: number,
    filter: number,
  ): Target {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }

  function disposeTarget(target: Target): void {
    gl.deleteTexture(target.tex);
    gl.deleteFramebuffer(target.fb);
  }

  function drawTo(target: Target | null): void {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function bindTex(unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null): void {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  /* --- 资源 ------------------------------------------------------------ */

  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let progSim: Program;
  let progUnder: Program;
  let progComp: Program;
  try {
    progSim = createProgram(VS, SIM_FS);
    progUnder = createProgram(VS, UNDER_FS);
    progComp = createProgram(VS, COMP_FS);
  } catch {
    return { ok: false, reason: "着色器编译失败，无法运行这片水面。" };
  }

  let simA = createTarget(SIM_W, SIM_H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
  let simB = createTarget(SIM_W, SIM_H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
  let under: Target | null = null;

  const koi = createKoiSchool();

  /* --- 涟漪注入 -------------------------------------------------------- */

  const dropBuf = new Float32Array(MAX_DROPS * 3);
  const pending: number[] = [];

  function addDrop(u: number, v: number, amp: number): void {
    if (u < -0.02 || u > 1.02 || v < -0.05 || v > 1.05) {
      return;
    }
    if (pending.length < MAX_DROPS * 3) {
      pending.push(u, v, amp);
    }
  }

  let nextAuto = 1.2;
  function autoDrops(t: number): void {
    if (t < nextAuto) {
      return;
    }
    nextAuto = t + 1.1 + Math.random() * 2.6;
    addDrop(0.06 + Math.random() * 0.88, 0.1 + Math.random() * 0.8, 0.011 + Math.random() * 0.015);
  }

  /* --- 尺寸 ------------------------------------------------------------ */

  let viewW = 0;
  let viewH = 0;
  let renderScale = 1.0;

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(2, Math.round(rect.width * dpr * renderScale));
    let h = Math.max(2, Math.round(rect.height * dpr * renderScale));
    if (w * h > MAX_VIEW_PIXELS) {
      const s = Math.sqrt(MAX_VIEW_PIXELS / (w * h));
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    if (w === viewW && h === viewH) {
      return;
    }
    viewW = w;
    viewH = h;
    canvas.width = w;
    canvas.height = h;
    if (under) {
      disposeTarget(under);
    }
    under = createTarget(
      Math.max(2, Math.round(w * 0.75)),
      Math.max(2, Math.round(h * 0.75)),
      gl.RGBA8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      gl.LINEAR,
    );
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  /* --- 渲染 ------------------------------------------------------------ */

  function stepSim(dropCount: number): void {
    progSim.use();
    gl.uniform2f(progSim.u("uTexel"), 1 / SIM_W, 1 / SIM_H);
    gl.uniform1f(progSim.u("uDamp"), SIM_DAMP);
    gl.uniform4f(progSim.u("uPhys"), PHYS[0], PHYS[1], PHYS[2], PHYS[3]);
    gl.uniform1i(progSim.u("uDropN"), dropCount);
    if (dropCount > 0) {
      gl.uniform3fv(progSim.u("uDrops[0]"), dropBuf);
    }
    bindTex(0, simA.tex, progSim.u("uPrev"));
    drawTo(simB);
    const tmp = simA;
    simA = simB;
    simB = tmp;
  }

  let simAcc = 0;

  function render(t: number, dt: number): void {
    koi.update(t, dt);

    gl.bindVertexArray(quadVao);
    gl.disable(gl.BLEND);

    const dropCount = (pending.length / 3) | 0;
    for (let i = 0; i < dropCount * 3; i++) {
      dropBuf[i] = pending[i];
    }
    pending.length = 0;

    // 仿真按固定步长推进，与帧率解耦；上限 5 步防止长暂停后追帧卡死
    simAcc += dt;
    let steps = 0;
    while (simAcc >= SIM_DT && steps < 5) {
      stepSim(steps === 0 ? dropCount : 0);
      simAcc -= SIM_DT;
      steps++;
    }
    if (steps === 0 && dropCount > 0) {
      stepSim(dropCount);
    }

    progUnder.use();
    gl.uniform1f(progUnder.u("uTime"), t);
    gl.uniform1i(progUnder.u("uKoiN"), KOI_COUNT);
    gl.uniform4fv(progUnder.u("uKoiA[0]"), koi.a);
    gl.uniform4fv(progUnder.u("uKoiB[0]"), koi.b);
    drawTo(under);

    progComp.use();
    gl.uniform2f(progComp.u("uRipTexel"), 1 / SIM_W, 1 / SIM_H);
    gl.uniform1f(progComp.u("uCellW"), CELL_W);
    gl.uniform1f(progComp.u("uTime"), t);
    gl.uniform4f(progComp.u("uTune"), TUNE[0], TUNE[1], TUNE[2], TUNE[3]);
    gl.uniform4f(progComp.u("uTune2"), TUNE2[0], TUNE2[1], TUNE2[2], 0.0);
    bindTex(0, under!.tex, progComp.u("uUnder"));
    bindTex(1, simA.tex, progComp.u("uRip"));
    drawTo(null);
  }

  /* --- 主循环 ---------------------------------------------------------- */

  // 仿真时钟独立于 wall clock：暂停期间不前进，恢复时水面不会跳变
  let elapsed = 0;
  let lastFrameMs = 0;
  let raf = 0;
  let frameCost = 16;
  let lastTune = 0;

  function frame(nowMs: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(Math.max((nowMs - lastFrameMs) / 1000, 0.0001), 0.05);
    lastFrameMs = nowMs;
    elapsed += dt;

    // 按实测帧耗时增减渲染分辨率，弱 GPU 上优先保帧率
    frameCost += (dt * 1000 - frameCost) * 0.05;
    if (elapsed - lastTune > 0.8) {
      lastTune = elapsed;
      const prev = renderScale;
      if (frameCost > 26 && renderScale > 0.62) {
        renderScale -= 0.1;
      } else if (frameCost < 14 && renderScale < 1.0) {
        renderScale = Math.min(1.0, renderScale + 0.08);
      }
      if (prev !== renderScale) {
        resize();
      }
    }

    autoDrops(elapsed);
    render(elapsed, dt);
  }

  function start(): void {
    if (raf) {
      return;
    }
    lastFrameMs = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop(): void {
    if (!raf) {
      return;
    }
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* --- 生命周期：只在可见时消耗 GPU ------------------------------------ */

  let onScreen = false;
  const visibilityObserver = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    syncRunning();
  });

  function syncRunning(): void {
    if (onScreen && document.visibilityState === "visible") {
      start();
    } else {
      stop();
    }
  }

  if (options.animated) {
    for (let i = 0; i < 4; i++) {
      addDrop(0.15 + i * 0.24, 0.3 + 0.35 * Math.random(), 0.017);
    }
    visibilityObserver.observe(canvas);
    document.addEventListener("visibilitychange", syncRunning);
  } else {
    render(0, SIM_DT);
  }

  /* --- 指针交互 -------------------------------------------------------- */

  let dragFrom: [number, number] | null = null;
  let notifiedFirstDrop = false;

  function toUv(e: PointerEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, 1 - (e.clientY - rect.top) / rect.height];
  }

  function onPointerDown(e: PointerEvent): void {
    canvas.setPointerCapture(e.pointerId);
    dragFrom = toUv(e);
    addDrop(dragFrom[0], dragFrom[1], 0.03);
    if (!notifiedFirstDrop) {
      notifiedFirstDrop = true;
      options.onFirstDrop?.();
    }
  }

  function onPointerMove(e: PointerEvent): void {
    const to = toUv(e);
    if (!dragFrom) {
      addDrop(to[0], to[1], 0.0018); // 悬停时留下极轻的痕迹
      return;
    }
    // 沿拖动路径补插落点，否则快速拖动会画出断续的珠链
    const dist = Math.hypot((to[0] - dragFrom[0]) * WORLD_W, to[1] - dragFrom[1]);
    const n = Math.min(Math.ceil(dist / 0.014), 6);
    const amp = 0.006 + Math.min(dist * 0.65, 0.021);
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      addDrop(
        dragFrom[0] + (to[0] - dragFrom[0]) * f,
        dragFrom[1] + (to[1] - dragFrom[1]) * f,
        (amp / n) * 1.7,
      );
    }
    dragFrom = to;
  }

  function onPointerEnd(): void {
    dragFrom = null;
  }

  if (options.animated) {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("pointerleave", onPointerEnd);
  }

  return {
    ok: true,
    pond: {
      destroy() {
        stop();
        visibilityObserver.disconnect();
        resizeObserver.disconnect();
        document.removeEventListener("visibilitychange", syncRunning);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerEnd);
        canvas.removeEventListener("pointercancel", onPointerEnd);
        canvas.removeEventListener("pointerleave", onPointerEnd);
        progSim.dispose();
        progUnder.dispose();
        progComp.dispose();
        disposeTarget(simA);
        disposeTarget(simB);
        if (under) {
          disposeTarget(under);
        }
        gl.deleteVertexArray(quadVao);
        gl.deleteBuffer(quadBuf);
      },
    },
  };
}
