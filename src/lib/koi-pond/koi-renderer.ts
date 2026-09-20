import { KOI_COUNT, KOI_ROWS, KOI_VERTEX_STRIDE, type KoiSchool } from "./koi";

export function createKoiRenderer(
  gl: WebGL2RenderingContext,
  program: { use(): void; u(name: string): WebGLUniformLocation | null },
) {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, KOI_ROWS * 2 * KOI_VERTEX_STRIDE * 4, gl.DYNAMIC_DRAW);
  for (let attribute = 0; attribute < 3; attribute++) {
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, KOI_VERTEX_STRIDE * 4, attribute * 8);
  }

  function drawSchool(koi: KoiSchool): void {
    program.use();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const shadow of [true, false]) {
      gl.uniform1i(program.u("uShadow"), shadow ? 1 : 0);
      gl.uniform2f(program.u("uOffset"), shadow ? 0.025 : 0, shadow ? -0.035 : 0);
      gl.colorMask(true, true, true, !shadow);
      for (let i = 0; i < KOI_COUNT; i++) {
        if (koi.a[i * 4] === -10) {
          continue;
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, koi.meshes[i].vertices);
        gl.uniform1i(program.u("uPalette"), koi.b[i * 4 + 3]);
        gl.uniform1f(program.u("uSeed"), i + 0.31);
        gl.uniform1f(program.u("uPhase"), koi.b[i * 4 + 1]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, KOI_ROWS * 2);
      }
    }
    gl.disable(gl.BLEND);
  }

  return {
    drawSchool,
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
    },
  };
}
