import { RIDE_SPAN } from "./travel-window-motion";

export type TravelScenery = {
  setInitial(image: HTMLImageElement): boolean;
  prepareRide(nextImage: HTMLImageElement): boolean;
  renderRide(track: number, blur: number): boolean;
  commitRide(): void;
  destroy(): void;
};

const FBO_PAD = 0.16;
const FBO_SPAN_X = 1 + FBO_PAD * 2;

const vertexSource = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(gl_VertexID == 2 ? 3.0 : -1.0, gl_VertexID == 1 ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const trackFragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform vec2 uScaleA;
uniform vec2 uScaleB;
uniform float uTrack;
uniform float uRideSpan;
uniform float uFineRadius;
uniform float uUsePad;
out vec4 fragColor;

float mirror01(float z) {
  float m = z - 2.0 * floor(z * 0.5);
  return 1.0 - abs(m - 1.0);
}

vec3 sampleTrack(float xScreen, float yScreen) {
  float shift = xScreen - 0.5 + uTrack;
  float uA = mirror01(0.5 + shift * uScaleA.x);
  float vA = clamp(0.5 + (yScreen - 0.5) * uScaleA.y, 0.0, 1.0);
  float uB = mirror01(0.5 + (shift - uRideSpan) * uScaleB.x);
  float vB = clamp(0.5 + (yScreen - 0.5) * uScaleB.y, 0.0, 1.0);
  float blend = smoothstep(0.26 * uRideSpan, 0.74 * uRideSpan, uTrack + (xScreen - 0.5));
  vec3 cA = texture(uTexA, vec2(uA, vA)).rgb;
  vec3 cB = texture(uTexB, vec2(uB, vB)).rgb;
  return mix(cA * cA, cB * cB, blend);
}

void main() {
  float xBase = uUsePad > 0.5 ? vUv.x * 1.32 - 0.16 : vUv.x;
  if (uFineRadius <= 0.0004) {
    fragColor = vec4(sqrt(sampleTrack(xBase, vUv.y)), 1.0);
    return;
  }
  float weights[9] = float[9](0.06, 0.09, 0.12, 0.15, 0.16, 0.15, 0.12, 0.09, 0.06);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float k = float(i - 4) / 4.0;
    acc += sampleTrack(xBase + k * uFineRadius, vUv.y) * weights[i];
  }
  fragColor = vec4(sqrt(acc), 1.0);
}
`;

const coarseFragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFboTex;
uniform float uCoarseRadius;
out vec4 fragColor;

void main() {
  float weights[9] = float[9](0.06, 0.09, 0.12, 0.15, 0.16, 0.15, 0.12, 0.09, 0.06);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float k = float(i - 4) / 4.0;
    float offset = k * uCoarseRadius;
    float uFbo = (vUv.x + offset + 0.16) / 1.32;
    vec3 c = texture(uFboTex, vec2(uFbo, vUv.y)).rgb;
    acc += (c * c) * weights[i];
  }
  fragColor = vec4(sqrt(acc), 1.0);
}
`;

function computeCoverScale(boxAspect: number, imageAspect: number): [number, number] {
  const ratio = boxAspect / imageAspect;
  return [ratio < 1 ? ratio : 1, ratio > 1 ? 1 / ratio : 1];
}

function imageAspect(image: HTMLImageElement) {
  return image.naturalWidth > 0 && image.naturalHeight > 0
    ? image.naturalWidth / image.naturalHeight
    : 1;
}

export function createTravelScenery(canvas: HTMLCanvasElement): TravelScenery | null {
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
  const programs: WebGLProgram[] = [];
  const textures: WebGLTexture[] = [];
  const vao = context.createVertexArray();
  const framebuffer = context.createFramebuffer();
  let observer: ResizeObserver | null = null;

  function dispose() {
    observer?.disconnect();
    observer = null;
    context.deleteFramebuffer(framebuffer);
    context.deleteVertexArray(vao);
    textures.forEach((texture) => context.deleteTexture(texture));
    programs.forEach((program) => context.deleteProgram(program));
    shaders.forEach((shader) => context.deleteShader(shader));
    context.getExtension("WEBGL_lose_context")?.loseContext();
  }

  try {
    if (!vao || !framebuffer) {
      throw new Error("Scenery buffer allocation failed");
    }

    function compile(type: number, source: string) {
      const shader = context.createShader(type);
      if (!shader) {
        throw new Error("Scenery shader allocation failed");
      }
      shaders.push(shader);
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        throw new Error(context.getShaderInfoLog(shader) || "Scenery shader compilation failed");
      }
      return shader;
    }

    const vertex = compile(context.VERTEX_SHADER, vertexSource);

    function linkProgram(fragmentSource: string, uniformNames: readonly string[]) {
      const program = context.createProgram();
      if (!program) {
        throw new Error("Scenery program allocation failed");
      }
      programs.push(program);
      context.attachShader(program, vertex);
      context.attachShader(program, compile(context.FRAGMENT_SHADER, fragmentSource));
      context.linkProgram(program);
      if (!context.getProgramParameter(program, context.LINK_STATUS)) {
        throw new Error(context.getProgramInfoLog(program) || "Scenery shader linking failed");
      }
      const uniforms = Object.fromEntries(
        uniformNames.map((name) => [name, context.getUniformLocation(program, name)]),
      );
      return { program, uniforms };
    }

    const trackPass = linkProgram(trackFragmentSource, [
      "uTexA",
      "uTexB",
      "uScaleA",
      "uScaleB",
      "uTrack",
      "uRideSpan",
      "uFineRadius",
      "uUsePad",
    ]);
    const coarsePass = linkProgram(coarseFragmentSource, ["uFboTex", "uCoarseRadius"]);

    function createLinearTexture() {
      const texture = context.createTexture();
      if (!texture) {
        throw new Error("Scenery texture allocation failed");
      }
      textures.push(texture);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
      return texture;
    }

    let texA = createLinearTexture();
    let texB = createLinearTexture();
    const fboTexture = createLinearTexture();

    context.bindVertexArray(vao);
    context.useProgram(trackPass.program);
    context.uniform1i(trackPass.uniforms.uTexA, 0);
    context.uniform1i(trackPass.uniforms.uTexB, 1);
    context.uniform1f(trackPass.uniforms.uRideSpan, RIDE_SPAN);
    context.useProgram(coarsePass.program);
    context.uniform1i(coarsePass.uniforms.uFboTex, 0);

    let aspectA = 1;
    let aspectB = 1;
    let boxAspect = 1;
    let fboWidth = 0;
    let fboHeight = 0;
    let initialized = false;
    let lastTrack = 0;
    let lastBlur = 0;

    function allocateFbo(canvasWidth: number, canvasHeight: number) {
      const targetWidth = Math.max(1, Math.round(canvasWidth * FBO_SPAN_X));
      if (targetWidth === fboWidth && canvasHeight === fboHeight) {
        return;
      }
      fboWidth = targetWidth;
      fboHeight = canvasHeight;
      context.bindTexture(context.TEXTURE_2D, fboTexture);
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context.RGBA8,
        fboWidth,
        fboHeight,
        0,
        context.RGBA,
        context.UNSIGNED_BYTE,
        null,
      );
      context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
      context.framebufferTexture2D(
        context.FRAMEBUFFER,
        context.COLOR_ATTACHMENT0,
        context.TEXTURE_2D,
        fboTexture,
        0,
      );
      if (context.checkFramebufferStatus(context.FRAMEBUFFER) !== context.FRAMEBUFFER_COMPLETE) {
        throw new Error("Scenery framebuffer is incomplete");
      }
      context.bindFramebuffer(context.FRAMEBUFFER, null);
    }

    function syncSize() {
      const box = canvas.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) {
        return false;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(box.width * dpr));
      const height = Math.max(1, Math.round(box.height * dpr));
      boxAspect = box.width / box.height;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      allocateFbo(width, height);
      return true;
    }

    function uploadTexture(texture: WebGLTexture, image: HTMLImageElement) {
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);
      context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context.RGBA,
        context.RGBA,
        context.UNSIGNED_BYTE,
        image,
      );
    }

    function renderRide(track: number, blur: number): boolean {
      if (context.isContextLost() || !initialized) {
        return false;
      }
      if (!fboWidth && !syncSize()) {
        return false;
      }
      lastTrack = track;
      lastBlur = blur;

      const [scaleAx, scaleAy] = computeCoverScale(boxAspect, aspectA);
      const [scaleBx, scaleBy] = computeCoverScale(boxAspect, aspectB);

      context.useProgram(trackPass.program);
      context.uniform2f(trackPass.uniforms.uScaleA, scaleAx, scaleAy);
      context.uniform2f(trackPass.uniforms.uScaleB, scaleBx, scaleBy);
      context.uniform1f(trackPass.uniforms.uTrack, track);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texA);
      context.activeTexture(context.TEXTURE1);
      context.bindTexture(context.TEXTURE_2D, texB);

      if (blur <= 0.0004) {
        context.bindFramebuffer(context.FRAMEBUFFER, null);
        context.viewport(0, 0, canvas.width, canvas.height);
        context.uniform1f(trackPass.uniforms.uFineRadius, 0);
        context.uniform1f(trackPass.uniforms.uUsePad, 0);
        context.drawArrays(context.TRIANGLES, 0, 3);
        return true;
      }

      // Pass 1 renders horizontal-padded virtual track into an offscreen FBO so Pass 2 never reads clamped border pixels.
      context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
      context.viewport(0, 0, fboWidth, fboHeight);
      context.uniform1f(trackPass.uniforms.uFineRadius, blur * 0.16);
      context.uniform1f(trackPass.uniforms.uUsePad, 1);
      context.drawArrays(context.TRIANGLES, 0, 3);

      context.bindFramebuffer(context.FRAMEBUFFER, null);
      context.viewport(0, 0, canvas.width, canvas.height);
      context.useProgram(coarsePass.program);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, fboTexture);
      context.uniform1f(coarsePass.uniforms.uCoarseRadius, blur * 0.88);
      context.drawArrays(context.TRIANGLES, 0, 3);
      return true;
    }

    observer = new ResizeObserver(() => {
      if (syncSize() && initialized) {
        renderRide(lastTrack, lastBlur);
      }
    });
    observer.observe(canvas);

    return {
      setInitial(image: HTMLImageElement) {
        if (context.isContextLost()) {
          return false;
        }
        syncSize();
        aspectA = imageAspect(image);
        aspectB = aspectA;
        uploadTexture(texA, image);
        uploadTexture(texB, image);
        initialized = true;
        return renderRide(0, 0);
      },
      prepareRide(nextImage: HTMLImageElement) {
        if (context.isContextLost() || !initialized) {
          return false;
        }
        aspectB = imageAspect(nextImage);
        uploadTexture(texB, nextImage);
        return true;
      },
      renderRide,
      commitRide() {
        if (!initialized) {
          return;
        }
        [texA, texB] = [texB, texA];
        [aspectA, aspectB] = [aspectB, aspectA];
        renderRide(0, 0);
      },
      destroy: dispose,
    };
  } catch {
    dispose();
    return null;
  }
}
