import type { PhotoRecord } from "./photo-catalog";

type NetworkState = {
  saveData?: boolean;
  effectiveType?: string;
};

export function photoFromArrow(
  key: string,
  previous: PhotoRecord | undefined,
  next: PhotoRecord | undefined,
): PhotoRecord | undefined {
  if (key === "ArrowLeft") {
    return previous;
  }
  if (key === "ArrowRight") {
    return next;
  }
  return undefined;
}

export function photoFromSwipe(
  deltaX: number,
  deltaY: number,
  previous: PhotoRecord | undefined,
  next: PhotoRecord | undefined,
): PhotoRecord | undefined {
  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) {
    return undefined;
  }
  return deltaX > 0 ? previous : next;
}

export function planPhotoPreload(
  previous: PhotoRecord | undefined,
  next: PhotoRecord | undefined,
  network: NetworkState | undefined,
): PhotoRecord | null {
  if (
    network?.saveData ||
    network?.effectiveType === "slow-2g" ||
    network?.effectiveType === "2g"
  ) {
    return null;
  }
  return next ?? previous ?? null;
}
