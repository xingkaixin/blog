/**
 * 锦鲤的运动学：李萨如轨迹叠加两组不可通约的频率，轨迹因此不会循环。
 * 纯 CPU 计算，结果按 shader 期望的布局写进两个 uniform 数组。
 */

interface KoiTrack {
  /** 轨迹中心（世界坐标） */
  center: readonly [number, number];
  /** 两轴振幅 */
  amp: readonly [number, number];
  /** 两轴角频率 */
  omega: readonly [number, number];
  /** 两轴初相 */
  phase: readonly [number, number];
  /** 体长的一半 */
  half: number;
  /** 配色编号，对应 shader 里的 koiPalette */
  palette: number;
}

const TRACKS: readonly KoiTrack[] = [
  {
    center: [0.95, 0.66],
    amp: [0.3, 0.13],
    omega: [0.079, 0.113],
    phase: [0.0, 1.7],
    half: 0.096,
    palette: 0,
  },
  {
    center: [2.1, 0.68],
    amp: [0.33, 0.14],
    omega: [0.067, 0.097],
    phase: [2.1, 0.4],
    half: 0.082,
    palette: 1,
  },
  {
    center: [2.0, 0.45],
    amp: [0.36, 0.15],
    omega: [0.091, 0.061],
    phase: [4.3, 2.9],
    half: 0.1,
    palette: 0,
  },
  {
    center: [1.42, 0.3],
    amp: [0.3, 0.13],
    omega: [0.073, 0.101],
    phase: [1.2, 5.1],
    half: 0.093,
    palette: 3,
  },
  {
    center: [0.98, 0.26],
    amp: [0.31, 0.11],
    omega: [0.059, 0.087],
    phase: [3.4, 1.1],
    half: 0.098,
    palette: 2,
  },
  {
    center: [2.55, 0.27],
    amp: [0.22, 0.12],
    omega: [0.089, 0.119],
    phase: [5.5, 3.8],
    half: 0.078,
    palette: 5,
  },
  {
    center: [1.72, 0.79],
    amp: [0.28, 0.09],
    omega: [0.101, 0.071],
    phase: [0.7, 4.6],
    half: 0.07,
    palette: 4,
  },
];

export const KOI_COUNT = TRACKS.length;

export interface KoiLure {
  index: number;
  x: number;
  y: number;
  biting: boolean;
}

export interface KoiSchool {
  /** 每尾 vec4：xy = 位置，zw = 朝向 */
  readonly a: Float32Array;
  /** 每尾 vec4：x = 半长，y = 尾摆相位，z = 摆幅，w = 配色编号 */
  readonly b: Float32Array;
  update(t: number, dt: number, lure?: KoiLure, hidden?: number): void;
}

export function createKoiSchool(): KoiSchool {
  const a = new Float32Array(32);
  const b = new Float32Array(32);
  const dir = TRACKS.map(() => [1, 0]);
  const tailPhase = TRACKS.map(() => Math.random() * 6.28);
  const offsets = TRACKS.map(() => [0, 0]);

  function update(t: number, dt: number, lure?: KoiLure, hidden = -1): void {
    for (let i = 0; i < TRACKS.length; i++) {
      const k = TRACKS[i];
      const a0 = k.omega[0] * t + k.phase[0];
      const a1 = k.omega[1] * t + k.phase[1];
      const b0 = 2.37 * k.omega[0] * t + k.phase[1] * 1.9;
      const b1 = 1.91 * k.omega[1] * t + k.phase[0] * 2.3;

      const x = k.center[0] + k.amp[0] * Math.sin(a0) + 0.045 * Math.sin(b0);
      const y = k.center[1] + k.amp[1] * Math.sin(a1) + 0.03 * Math.sin(b1);
      let vx = k.amp[0] * k.omega[0] * Math.cos(a0) + 0.045 * 2.37 * k.omega[0] * Math.cos(b0);
      let vy = k.amp[1] * k.omega[1] * Math.cos(a1) + 0.03 * 1.91 * k.omega[1] * Math.cos(b1);

      const offset = offsets[i];
      const heading = dir[i];
      const attracted = lure?.index === i;
      const targetX = attracted ? lure.x - heading[0] * k.half * 0.85 - x : 0;
      const targetY = attracted ? lure.y - heading[1] * k.half * 0.85 - y : 0;
      const blend = 1 - Math.exp(-dt * (attracted ? 2.5 : 0.8));
      const dx = (targetX - offset[0]) * blend;
      const dy = (targetY - offset[1]) * blend;
      offset[0] += dx;
      offset[1] += dy;
      if (dt > 0) {
        vx += dx / dt;
        vy += dy / dt;
      }

      const speed = Math.hypot(vx, vy);
      if (speed > 1e-5) {
        // 朝向按指数收敛跟随速度方向，转身才有惯性而不是瞬时折角
        const blend = 1 - Math.exp(-dt * 3.0);
        heading[0] += (vx / speed - heading[0]) * blend;
        heading[1] += (vy / speed - heading[1]) * blend;
        const len = Math.hypot(heading[0], heading[1]) || 1;
        heading[0] /= len;
        heading[1] /= len;
      }
      tailPhase[i] += dt * (attracted && lure.biting ? 36 : 5.0 + 60.0 * speed);

      a[i * 4] = i === hidden ? -10 : x + offset[0];
      a[i * 4 + 1] = i === hidden ? -10 : y + offset[1];
      a[i * 4 + 2] = heading[0];
      a[i * 4 + 3] = heading[1];
      b[i * 4] = k.half;
      b[i * 4 + 1] = tailPhase[i];
      b[i * 4 + 2] = 0.055 + 0.3 * Math.min(speed * 12.0, 1.0);
      b[i * 4 + 3] = k.palette;
    }
  }

  update(0, 0);
  return { a, b, update };
}
