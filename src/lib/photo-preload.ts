import type { PhotoRecord, PhotoVariantWidth } from "./photo-catalog";

type NetworkState = {
  saveData?: boolean;
  effectiveType?: string;
};

export type PhotoPreloadPlan = {
  photo: PhotoRecord;
  width: PhotoVariantWidth;
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
  viewportWidth: number,
  network: NetworkState | undefined,
): PhotoPreloadPlan | null {
  if (
    network?.saveData ||
    network?.effectiveType === "slow-2g" ||
    network?.effectiveType === "2g"
  ) {
    return null;
  }
  const photo = next ?? previous;
  if (!photo) {
    return null;
  }
  return {
    photo,
    width: viewportWidth < 1_280 ? 960 : 2048,
  };
}
