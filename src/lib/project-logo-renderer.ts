import {
  blurSource,
  compositeSource,
  crtSource,
  outlineSource,
  vertexSource,
} from "./project-logo-shaders";

export const LOGO_SIZE = 112;
export const SWEEP_DURATION = 2400;

export function createProjectLogoRenderer() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = LOGO_SIZE;
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    return null;
  }
  const shaders: WebGLShader[] = [];
  const programs: WebGLProgram[] = [];
  const textures = new Set<WebGLTexture>();
  const framebuffer = gl.createFramebuffer();

  function dispose() {
    if (!gl) {
      return;
    }
    gl.deleteFramebuffer(framebuffer);
    textures.forEach((texture) => gl.deleteTexture(texture));
    programs.forEach((program) => gl.deleteProgram(program));
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  try {
    if (!framebuffer) {
      throw new Error("Logo framebuffer allocation failed");
    }
    const context = gl;
    function compile(type: number, source: string) {
      const shader = context.createShader(type);
      if (!shader) {
        throw new Error("Logo shader allocation failed");
      }
      shaders.push(shader);
      context.shaderSource(shader, source);
      context.compileShader(shader);
      return shader;
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    function program(source: string) {
      const program = context.createProgram();
      if (!program) {
        throw new Error("Logo program allocation failed");
      }
      programs.push(program);
      context.attachShader(program, vertex);
      context.attachShader(program, compile(context.FRAGMENT_SHADER, source));
      context.linkProgram(program);
      if (!context.getProgramParameter(program, context.LINK_STATUS)) {
        throw new Error("Logo shader linking failed");
      }
      context.useProgram(program);
      const uniforms = Object.fromEntries(
        [
          "uSource",
          "uSourceSize",
          "uElapsed",
          "uPhase",
          "uMotion",
          "uWidth",
          "uHeight",
          "uDirection",
          "uRadius",
          "uCrt",
          "uBloom",
        ].map((name) => [name, context.getUniformLocation(program, name)]),
      );
      context.uniform1i(uniforms.uWidth, LOGO_SIZE);
      context.uniform1i(uniforms.uHeight, LOGO_SIZE);
      context.uniform2f(uniforms.uSourceSize, LOGO_SIZE, LOGO_SIZE);
      context.uniform1i(uniforms.uBloom, 1);
      return { program, uniforms };
    }
    const outline = program(outlineSource);
    const crt = program(crtSource);
    const blur = program(blurSource);
    const composite = program(compositeSource);
    function texture() {
      const texture = context.createTexture();
      if (!texture) {
        throw new Error("Logo texture allocation failed");
      }
      textures.add(texture);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
      return texture;
    }
    function target() {
      const result = texture();
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context.RGBA8,
        LOGO_SIZE,
        LOGO_SIZE,
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
        result,
        0,
      );
      if (context.checkFramebufferStatus(context.FRAMEBUFFER) !== context.FRAMEBUFFER_COMPLETE) {
        throw new Error("Logo framebuffer is incomplete");
      }
      return result;
    }
    const crtTexture = target();
    const blurA = target();
    const blurB = target();
    gl.viewport(0, 0, LOGO_SIZE, LOGO_SIZE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const source = document.createElement("canvas");
    source.width = source.height = LOGO_SIZE;
    const sourceContext = source.getContext("2d");
    if (!sourceContext) {
      throw new Error("Logo source canvas unavailable");
    }
    function pass(program: WebGLProgram, input: WebGLTexture, output: WebGLTexture | null) {
      context.useProgram(program);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, input);
      context.bindFramebuffer(context.FRAMEBUFFER, output ? framebuffer : null);
      if (output) {
        context.framebufferTexture2D(
          context.FRAMEBUFFER,
          context.COLOR_ATTACHMENT0,
          context.TEXTURE_2D,
          output,
          0,
        );
      }
      context.drawArrays(context.TRIANGLES, 0, 3);
    }
    return {
      canvas,
      dispose,
      upload(image: HTMLImageElement) {
        const result = texture();
        const scale = 96 / Math.max(image.naturalWidth, image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        sourceContext.clearRect(0, 0, LOGO_SIZE, LOGO_SIZE);
        sourceContext.drawImage(
          image,
          (LOGO_SIZE - width) / 2,
          (LOGO_SIZE - height) / 2,
          width,
          height,
        );
        context.texImage2D(
          context.TEXTURE_2D,
          0,
          context.RGBA,
          context.RGBA,
          context.UNSIGNED_BYTE,
          source,
        );
        return result;
      },
      draw(input: WebGLTexture, output: CanvasRenderingContext2D, elapsed: number | null) {
        if (context.isContextLost()) {
          return false;
        }
        if (elapsed === null) {
          pass(outline.program, input, null);
        } else {
          context.useProgram(crt.program);
          context.uniform1f(crt.uniforms.uElapsed, elapsed);
          context.uniform1f(
            crt.uniforms.uPhase,
            elapsed < SWEEP_DURATION ? elapsed / SWEEP_DURATION : 0.62,
          );
          context.uniform1f(crt.uniforms.uMotion, elapsed < SWEEP_DURATION ? 1 : 0);
          pass(crt.program, input, crtTexture);
          context.useProgram(blur.program);
          context.uniform1f(blur.uniforms.uRadius, 1.6);
          context.uniform2f(blur.uniforms.uDirection, 1, 0);
          pass(blur.program, crtTexture, blurA);
          context.uniform2f(blur.uniforms.uDirection, 0, 1);
          pass(blur.program, blurA, blurB);
          context.activeTexture(context.TEXTURE1);
          context.bindTexture(context.TEXTURE_2D, blurB);
          pass(composite.program, crtTexture, null);
        }
        output.clearRect(0, 0, LOGO_SIZE, LOGO_SIZE);
        output.drawImage(canvas, 0, 0);
        return true;
      },
      deleteTexture(texture: WebGLTexture) {
        context.deleteTexture(texture);
        textures.delete(texture);
      },
    };
  } catch {
    dispose();
    return null;
  }
}
