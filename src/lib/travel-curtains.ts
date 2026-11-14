export type TravelCurtains = {
  step(dt: number, trainSpeed: number, trainAcceleration: number): boolean;
  reset(): void;
  destroy(): void;
};

// Positions as fractions of the window width, aligned to frame.webp rod and sill.
const ROD_END = 0.105;
const CURTAIN_WIDTH = 0.165;
const CURTAIN_TOP = 0.094;
const CURTAIN_BOTTOM = 0.9;
const CURTAIN_HEIGHT = CURTAIN_BOTTOM - CURTAIN_TOP;
const CURTAIN_BLEED = 0.08;
const CANVAS_SPAN_X = 1 + CURTAIN_BLEED * 2;

const NODES = 24;
const COLS = 18;
const ROWS = 40;
const VERTEX_COUNT = (COLS + 1) * (ROWS + 1);
const INDEX_COUNT = COLS * ROWS * 6;

const STEP = 1 / 240;
const GRAVITY = 13.5;
const BEND = 0.00011;
const BEND_DAMP = 0.012;
const AIR_DAMP = 1.85;
const PUSH = 0.22;
const DRAFT = 0.028;

type EdgeChain = {
  x: Float64Array;
  v: Float64Array;
  acc: Float64Array;
};

type CurtainPanel = {
  side: -1 | 1;
  leftEdge: EdgeChain;
  rightEdge: EdgeChain;
  vertices: Float32Array;
};

const vertexSource = `
attribute vec2 aPos;
attribute vec2 aUv;
attribute float aShade;
uniform vec2 uOffset;
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = aUv;
  vShade = aShade;
  vec2 p = aPos + uOffset;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}
`;

const fragmentSource = `
precision mediump float;
varying vec2 vUv;
varying float vShade;
uniform sampler2D uTex;
uniform float uShadow;
void main() {
  vec4 tex = texture2D(uTex, vUv);
  if (uShadow > 0.5) {
    float a = tex.a * 0.095;
    gl_FragColor = vec4(vec3(0.12, 0.12, 0.11) * a, a);
    return;
  }
  vec3 tint = vShade < 0.0
    ? mix(vec3(1.0), vec3(0.94, 0.96, 0.95), clamp(-vShade * 8.0, 0.0, 1.0))
    : mix(vec3(1.0), vec3(1.02, 1.01, 0.99), clamp(vShade * 10.0, 0.0, 1.0));
  vec3 rgb = tex.rgb * (1.0 + vShade) * tint + max(0.0, vShade) * 0.06 * tex.a;
  gl_FragColor = vec4(clamp(rgb, 0.0, tex.a), tex.a);
}
`;

function createEdgeChain(): EdgeChain {
  return {
    x: new Float64Array(NODES + 1),
    v: new Float64Array(NODES + 1),
    acc: new Float64Array(NODES + 1),
  };
}

function createCurtainPanel(side: -1 | 1): CurtainPanel {
  return {
    side,
    leftEdge: createEdgeChain(),
    rightEdge: createEdgeChain(),
    vertices: new Float32Array(VERTEX_COUNT * 3),
  };
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleChain(x: Float64Array, v: number) {
  const at = Math.min(NODES, Math.max(0, v)) * NODES;
  const i = Math.min(NODES - 1, Math.floor(at));
  const t = at - i;
  const p0 = i > 0 ? x[i - 1] : -x[1];
  const p1 = x[i];
  const p2 = x[i + 1];
  const p3 = i + 2 <= NODES ? x[i + 2] : 2 * x[NODES] - x[NODES - 1];
  const t2 = t * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t2 * t)
  );
}

function createMeshIndices() {
  const indices = new Uint16Array(INDEX_COUNT);
  let cursor = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i0 = r * (COLS + 1) + c;
      const i1 = i0 + 1;
      const i2 = i0 + COLS + 1;
      const i3 = i2 + 1;
      indices[cursor++] = i0;
      indices[cursor++] = i1;
      indices[cursor++] = i2;
      indices[cursor++] = i1;
      indices[cursor++] = i3;
      indices[cursor++] = i2;
    }
  }
  return indices;
}

function createUvCoords(mirrorX: boolean) {
  const uvs = new Float32Array(VERTEX_COUNT * 2);
  let cursor = 0;
  for (let r = 0; r <= ROWS; r++) {
    const v = r / ROWS;
    for (let c = 0; c <= COLS; c++) {
      const u = c / COLS;
      uvs[cursor++] = mirrorX ? 1 - u : u;
      uvs[cursor++] = v;
    }
  }
  return uvs;
}

function updatePanelMesh(panel: CurtainPanel) {
  const { side, leftEdge, rightEdge, vertices } = panel;
  const x0 = side < 0 ? ROD_END : 1 - ROD_END - CURTAIN_WIDTH;
  const ringSlideL = 0.06 * sampleChain(leftEdge.x, 0.08);
  const ringSlideR = 0.06 * sampleChain(rightEdge.x, 0.08);
  const rowHeight = CURTAIN_HEIGHT / ROWS;

  let prevDxC = 0;
  let lift = 0;
  let cursor = 0;

  for (let r = 0; r <= ROWS; r++) {
    const v = r / ROWS;
    const bodyWeight = smoothstep(0.028, 0.078, v);
    const dxL = ringSlideL * (1 - bodyWeight) + sampleChain(leftEdge.x, v) * bodyWeight;
    const dxR = ringSlideR * (1 - bodyWeight) + sampleChain(rightEdge.x, v) * bodyWeight;
    const dxC = 0.5 * (dxL + dxR);

    let sinTheta = 0;
    if (r > 0) {
      const slope = (dxC - prevDxC) / rowHeight;
      const invLen = 1 / Math.hypot(1, slope);
      sinTheta = slope * invLen;
      lift -= (1 - invLen) * rowHeight;
    }
    prevDxC = dxC;

    const span = CURTAIN_WIDTH + dxR - dxL;
    const lambda = span / CURTAIN_WIDTH;
    const gather = 1 - lambda;
    const tiltWeight = smoothstep(0.04, 0.18, v);

    for (let c = 0; c <= COLS; c++) {
      const u = c / COLS;
      const billowX = 4 * u * (1 - u) * dxC * 0.07;
      const pleatX = Math.sin(u * Math.PI * 5) * gather * CURTAIN_WIDTH * 0.04 * bodyWeight;
      const wx = x0 + dxL + u * span + billowX + pleatX;
      const wy =
        CURTAIN_TOP +
        v * CURTAIN_HEIGHT +
        lift -
        (u - 0.5) * CURTAIN_WIDTH * lambda * sinTheta * 0.65 * tiltWeight;

      const foldShade =
        (lambda - 1) * 0.35 - Math.cos(u * Math.PI * 10) * Math.max(0, gather) * 0.18 * bodyWeight;
      const inner = side < 0 ? u : 1 - u;
      const rimLift = Math.pow(inner, 2.4) * (0.015 + Math.max(0, -side * dxC) * 0.22) * bodyWeight;
      const shade = Math.max(-0.09, Math.min(0.05, foldShade + rimLift));

      vertices[cursor++] = (wx + CURTAIN_BLEED) / CANVAS_SPAN_X;
      vertices[cursor++] = wy;
      vertices[cursor++] = shade;
    }
  }
}

function computeEdgeAcceleration(
  chain: EdgeChain,
  stiff: number,
  edgeGain: number,
  inertia: number,
  flutter: number,
) {
  const { x, v, acc } = chain;
  const dy = 1 / NODES;
  const dy2 = dy * dy;
  const dy4 = dy2 * dy2;

  acc[1] = -420 * x[1] - 32 * v[1] + inertia * 0.04;

  for (let i = 2; i <= NODES; i++) {
    const s = i * dy;
    const above = (1.08 - (i - 0.5) * dy) * (x[i - 1] - x[i]);
    const below = i < NODES ? (1.08 - (i + 0.5) * dy) * (x[i + 1] - x[i]) : 0;
    const mass = i < NODES ? 1 : 0.65;
    const fTension = (GRAVITY * stiff * (above + below)) / (dy2 * mass);

    const xm2 = x[i - 2];
    const xm1 = x[i - 1];
    const xp1 = i < NODES ? x[i + 1] : 2 * x[NODES] - x[NODES - 1];
    const xp2 = i <= NODES - 2 ? x[i + 2] : 2 * xp1 - (i === NODES - 1 ? x[NODES] : xm1);
    const d4x = (xm2 - 4 * xm1 + 6 * x[i] - 4 * xp1 + xp2) / dy4;

    const vp1 = i < NODES ? v[i + 1] : v[NODES];
    const d2v = (v[i - 1] - 2 * v[i] + vp1) / dy2;
    const drag = AIR_DAMP * (0.5 + 0.85 * s) * v[i] + 9 * Math.abs(v[i]) * v[i];
    const env = Math.min(1, Math.max(0, (s - 0.035) / 0.07));

    acc[i] =
      fTension - BEND * d4x + BEND_DAMP * d2v - drag + (inertia * edgeGain + flutter * s) * env;
  }
}

function createStaticFallback(canvas: HTMLCanvasElement, src: string): TravelCurtains | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const image = new Image();
  let disposed = false;
  let loaded = false;

  const draw = () => {
    if (disposed || !loaded) {
      return;
    }
    const box = canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) {
      return;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(box.width * ratio));
    const height = Math.max(1, Math.round(box.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const size = box.width / CANVAS_SPAN_X;
    const scale = width / box.width;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    const w = CURTAIN_WIDTH * size;
    const h = CURTAIN_HEIGHT * size;
    const top = CURTAIN_TOP * size;
    const leftX = (CURTAIN_BLEED + ROD_END) * size;
    const rightX = (CURTAIN_BLEED + 1 - ROD_END - CURTAIN_WIDTH) * size;
    ctx.drawImage(image, leftX, top, w, h);
    ctx.save();
    ctx.translate(rightX + w, top);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0, w, h);
    ctx.restore();
  };

  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  image.addEventListener("load", () => {
    loaded = true;
    draw();
  });
  image.src = src;

  return {
    step: () => false,
    reset: draw,
    destroy() {
      disposed = true;
      observer.disconnect();
    },
  };
}

export function createCurtains(canvas: HTMLCanvasElement, src: string): TravelCurtains | null {
  const contextOptions: WebGLContextAttributes = {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  };
  const gl =
    canvas.getContext("webgl2", contextOptions) ?? canvas.getContext("webgl", contextOptions);
  if (!gl) {
    return createStaticFallback(canvas, src);
  }

  const context = gl;
  const shaders: WebGLShader[] = [];
  const buffers: WebGLBuffer[] = [];
  let program: WebGLProgram | null = null;
  let texture: WebGLTexture | null = null;
  let observer: ResizeObserver | null = null;
  let disposed = false;

  function dispose() {
    disposed = true;
    observer?.disconnect();
    observer = null;
    if (texture) {
      context.deleteTexture(texture);
    }
    buffers.forEach((buffer) => context.deleteBuffer(buffer));
    if (program) {
      context.deleteProgram(program);
    }
    shaders.forEach((shader) => context.deleteShader(shader));
    context.getExtension("WEBGL_lose_context")?.loseContext();
  }

  try {
    function compile(type: number, source: string) {
      const shader = context.createShader(type);
      if (!shader) {
        throw new Error("Curtain shader allocation failed");
      }
      shaders.push(shader);
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        throw new Error(context.getShaderInfoLog(shader) || "Curtain shader compilation failed");
      }
      return shader;
    }

    program = context.createProgram();
    if (!program) {
      throw new Error("Curtain program allocation failed");
    }
    context.attachShader(program, compile(context.VERTEX_SHADER, vertexSource));
    context.attachShader(program, compile(context.FRAGMENT_SHADER, fragmentSource));
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) {
      throw new Error(context.getProgramInfoLog(program) || "Curtain shader linking failed");
    }

    function createBuffer() {
      const buffer = context.createBuffer();
      if (!buffer) {
        throw new Error("Curtain buffer allocation failed");
      }
      buffers.push(buffer);
      return buffer;
    }

    const vertexBuffer = createBuffer();
    const indexBuffer = createBuffer();
    const uvBuffers = [createBuffer(), createBuffer()];

    context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
    context.bufferData(context.ELEMENT_ARRAY_BUFFER, createMeshIndices(), context.STATIC_DRAW);

    context.bindBuffer(context.ARRAY_BUFFER, uvBuffers[0]);
    context.bufferData(context.ARRAY_BUFFER, createUvCoords(false), context.STATIC_DRAW);
    context.bindBuffer(context.ARRAY_BUFFER, uvBuffers[1]);
    context.bufferData(context.ARRAY_BUFFER, createUvCoords(true), context.STATIC_DRAW);

    texture = context.createTexture();
    if (!texture) {
      throw new Error("Curtain texture allocation failed");
    }
    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);

    const posLoc = context.getAttribLocation(program, "aPos");
    const uvLoc = context.getAttribLocation(program, "aUv");
    const shadeLoc = context.getAttribLocation(program, "aShade");
    const offsetLoc = context.getUniformLocation(program, "uOffset");
    const texLoc = context.getUniformLocation(program, "uTex");
    const shadowLoc = context.getUniformLocation(program, "uShadow");

    context.useProgram(program);
    context.uniform1i(texLoc, 0);
    context.enableVertexAttribArray(posLoc);
    context.enableVertexAttribArray(uvLoc);
    context.enableVertexAttribArray(shadeLoc);
    context.enable(context.BLEND);
    context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
    context.clearColor(0, 0, 0, 0);

    const panels = [createCurtainPanel(-1), createCurtainPanel(1)];
    for (const panel of panels) {
      updatePanelMesh(panel);
    }

    let textureReady = false;
    let clock = 0;

    function resetState() {
      clock = 0;
      for (const panel of panels) {
        panel.leftEdge.x.fill(0);
        panel.leftEdge.v.fill(0);
        panel.rightEdge.x.fill(0);
        panel.rightEdge.v.fill(0);
        updatePanelMesh(panel);
      }
    }

    function syncSize() {
      const box = canvas.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) {
        return false;
      }
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(box.width * ratio));
      const height = Math.max(1, Math.round(box.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.viewport(0, 0, canvas.width, canvas.height);
      return true;
    }

    function draw() {
      if (disposed || context.isContextLost() || !textureReady) {
        return;
      }
      if (canvas.width <= 0 || canvas.height <= 0) {
        if (!syncSize()) {
          return;
        }
      }
      context.viewport(0, 0, canvas.width, canvas.height);
      context.clear(context.COLOR_BUFFER_BIT);
      context.useProgram(program);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);

      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        context.bindBuffer(context.ARRAY_BUFFER, uvBuffers[i]);
        context.vertexAttribPointer(uvLoc, 2, context.FLOAT, false, 0, 0);

        context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
        context.bufferData(context.ARRAY_BUFFER, panel.vertices, context.DYNAMIC_DRAW);
        context.vertexAttribPointer(posLoc, 2, context.FLOAT, false, 12, 0);
        context.vertexAttribPointer(shadeLoc, 1, context.FLOAT, false, 12, 8);

        const hemSwing = 0.5 * (panel.leftEdge.x[NODES] + panel.rightEdge.x[NODES]);
        context.uniform2f(
          offsetLoc,
          (0.005 + Math.abs(hemSwing) * 0.08) * (panel.side < 0 ? 0.6 : -0.4),
          0.007,
        );
        context.uniform1f(shadowLoc, 1);
        context.drawElements(context.TRIANGLES, INDEX_COUNT, context.UNSIGNED_SHORT, 0);

        context.uniform2f(offsetLoc, 0, 0);
        context.uniform1f(shadowLoc, 0);
        context.drawElements(context.TRIANGLES, INDEX_COUNT, context.UNSIGNED_SHORT, 0);
      }
    }

    function step(dt: number, trainSpeed: number, trainAcceleration: number) {
      let remaining = Math.min(0.05, Math.max(0, dt));
      const inertia = -PUSH * trainAcceleration;

      while (remaining > 1e-6) {
        const h = Math.min(STEP, remaining);
        remaining -= h;
        clock += h;

        for (const panel of panels) {
          const { side, leftEdge, rightEdge } = panel;
          const stiffL = side < 0 ? 1.04 : 0.84;
          const stiffR = side < 0 ? 0.84 : 1.04;
          const phase = side < 0 ? 0 : 1.9;
          const flutter =
            DRAFT * trainSpeed * (0.45 * -side + 0.55 * Math.sin(clock * 7.5 + phase));

          computeEdgeAcceleration(
            leftEdge,
            stiffL,
            side < 0 ? 0.9 : 1.12,
            inertia,
            side > 0 ? flutter : 0,
          );
          computeEdgeAcceleration(
            rightEdge,
            stiffR,
            side < 0 ? 1.12 : 0.9,
            inertia,
            side < 0 ? flutter : 0,
          );

          for (let i = 1; i <= NODES; i++) {
            leftEdge.v[i] += leftEdge.acc[i] * h;
            rightEdge.v[i] += rightEdge.acc[i] * h;
            leftEdge.x[i] += leftEdge.v[i] * h;
            rightEdge.x[i] += rightEdge.v[i] * h;

            const diff = rightEdge.x[i] - leftEdge.x[i];
            const ratio = 1 + diff / CURTAIN_WIDTH;
            const kh = diff < 0 ? 14 : 34 + 420 * Math.max(0, ratio - 1.02);
            const fh = kh * diff + 2.8 * (rightEdge.v[i] - leftEdge.v[i]);
            leftEdge.v[i] += fh * h;
            rightEdge.v[i] -= fh * h;

            if (ratio > 1.055) {
              const excess = (ratio - 1.055) * CURTAIN_WIDTH * 0.5;
              leftEdge.x[i] += excess;
              rightEdge.x[i] -= excess;
            } else if (ratio < 0.78) {
              const deficit = (0.78 - ratio) * CURTAIN_WIDTH * 0.5;
              leftEdge.x[i] -= deficit;
              rightEdge.x[i] += deficit;
            }
          }
        }
      }

      let maxEnergy = 0;
      for (const panel of panels) {
        for (let i = 1; i <= NODES; i++) {
          const eL = Math.abs(panel.leftEdge.x[i]) + Math.abs(panel.leftEdge.v[i]);
          const eR = Math.abs(panel.rightEdge.x[i]) + Math.abs(panel.rightEdge.v[i]);
          if (eL > maxEnergy) {
            maxEnergy = eL;
          }
          if (eR > maxEnergy) {
            maxEnergy = eR;
          }
        }
      }

      const settled = trainSpeed === 0 && trainAcceleration === 0 && maxEnergy < 3e-4;
      if (settled) {
        resetState();
      } else {
        for (const panel of panels) {
          updatePanelMesh(panel);
        }
      }
      draw();
      return !settled;
    }

    observer = new ResizeObserver(() => {
      if (syncSize()) {
        draw();
      }
    });
    observer.observe(canvas);

    const image = new Image();
    image.addEventListener("load", () => {
      if (disposed || context.isContextLost()) {
        return;
      }
      syncSize();
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      // Premultiplied alpha keeps fine dark ring edges free of dark fringe halos when filtered.
      context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context.RGBA,
        context.RGBA,
        context.UNSIGNED_BYTE,
        image,
      );
      textureReady = true;
      draw();
    });
    image.src = src;

    return {
      step,
      reset() {
        resetState();
        draw();
      },
      destroy: dispose,
    };
  } catch {
    dispose();
    return createStaticFallback(canvas, src);
  }
}
