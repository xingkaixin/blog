export const HOLD_DURATION_MS = 7000;
export const RIDE_DURATION_MS = 2300;
export const RIDE_SPAN = 3.2;

export type RideSample = {
  progress: number;
  track: number;
  speed: number;
  acceleration: number;
  blur: number;
};

export function sampleTravelRide(tau: number): RideSample {
  if (tau <= 0) {
    return { progress: 0, track: 0, speed: 0, acceleration: 0, blur: 0 };
  }
  if (tau >= 1) {
    return { progress: 1, track: RIDE_SPAN, speed: 0, acceleration: 0, blur: 0 };
  }

  // Asymmetric polynomial time-warp makes departure snappy and arrival unhurried while keeping C2 continuity.
  const k = 0.22;
  const u = tau + k * tau * (1 - tau);
  const du = 1 + k * (1 - 2 * tau);
  const d2u = -2 * k;

  const s = u * u * u * (10 - 15 * u + 6 * u * u);
  const ds = 30 * u * u * (1 - u) * (1 - u);
  const d2s = 60 * u * (1 - u) * (1 - 2 * u);

  const durationSec = RIDE_DURATION_MS / 1000;
  const dsdtau = ds * du;
  const d2sdtau2 = d2s * du * du + ds * d2u;

  const hatV = Math.min(1, dsdtau / 1.94);

  return {
    progress: s,
    track: RIDE_SPAN * s,
    speed: (RIDE_SPAN / durationSec) * dsdtau,
    acceleration: (RIDE_SPAN / (durationSec * durationSec)) * d2sdtau2,
    blur: 0.135 * Math.pow(hatV, 1.15),
  };
}
