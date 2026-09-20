import { Fishing, FishingPhase } from "./fishing";
import { getReelPose } from "./fishing-overlay";
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
    gl.uniform2f(program.u("uAnchor"), 0, 0);
    gl.uniform2f(program.u("uWriggle"), 0, 0);
    gl.uniform1f(program.u("uOpacity"), 1);
    for (const shadow of [true, false]) {
      gl.uniform1i(program.u("uShadow"), shadow ? 1 : 0);
      gl.uniform4f(program.u("uTransform"), shadow ? 0.025 : 0, shadow ? -0.035 : 0, 1, 0);
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

  function drawCatch(fishing: Fishing, width: number, height: number): void {
    const state = fishing.state;
    if (state.phase !== FishingPhase.Reeling) {
      return;
    }
    const { pose } = state;
    const reel = getReelPose(pose, fishing.stateTime, width, height);
    program.use();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pose.vertices);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(program.u("uShadow"), 0);
    gl.uniform1i(program.u("uPalette"), state.catch.palette);
    gl.uniform1f(program.u("uSeed"), state.fish + 0.31);
    gl.uniform1f(program.u("uPhase"), pose.phase + fishing.stateTime * 18);
    gl.uniform1f(program.u("uOpacity"), reel.opacity);
    gl.uniform2f(program.u("uAnchor"), pose.mouth.x, pose.mouth.y);
    gl.uniform2f(program.u("uWriggle"), reel.wriggle, fishing.stateTime * 22);
    gl.uniform4f(
      program.u("uTransform"),
      (reel.end.x - width / 2) / height + 1.5,
      1 - reel.end.y / height,
      Math.cos(reel.angle) * reel.scale,
      Math.sin(reel.angle) * reel.scale,
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, KOI_ROWS * 2);
    gl.disable(gl.BLEND);
  }

  return {
    drawSchool,
    drawCatch,
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
    },
  };
}
