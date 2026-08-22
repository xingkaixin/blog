import { createHash } from "node:crypto";
import {
  isPhotoArtifactKey,
  photoIdFromMediaObjectKey,
  type PhotoPeriod,
  type RetiredArtifactBatch,
  type RetiredPhotoObjects,
} from "../../src/lib/photo-catalog";

const RETIRED_OBJECT_GRACE_MS = 25 * 60 * 60 * 1_000;

export type PhotoRetirementState = {
  photoMonths: Map<string, string>;
  retiredObjects: Map<string, RetiredPhotoObjects>;
  retiredArtifacts: Map<string, RetiredArtifactBatch>;
};

export function photoRetirementDeadline(retiredAt: Date): string {
  return new Date(retiredAt.getTime() + RETIRED_OBJECT_GRACE_MS).toISOString();
}

export function hasUnreferencedPhotoArtifacts(
  state: PhotoRetirementState,
  periods: Map<string, PhotoPeriod>,
  objectKeys: Iterable<string>,
): boolean {
  const retiredKeys = allRetiredObjectKeys(state);
  return [...objectKeys].some(
    (key) => !retiredKeys.has(key) && !isPhotoArtifactReferenced(periods, state.photoMonths, key),
  );
}

export function retireUnreferencedPhotoArtifacts(
  state: PhotoRetirementState,
  periods: Map<string, PhotoPeriod>,
  objectKeys: Iterable<string>,
  retiredAt: Date,
): void {
  const retiredKeys = allRetiredObjectKeys(state);
  const candidates = [...objectKeys]
    .filter((key) => {
      if (!isPhotoArtifactKey(key)) {
        throw new Error(`无法回收未知的照片对象路径 ${key}`);
      }
      return !retiredKeys.has(key) && !isPhotoArtifactReferenced(periods, state.photoMonths, key);
    })
    .toSorted();
  if (candidates.length === 0) {
    return;
  }

  const deleteAfter = photoRetirementDeadline(retiredAt);
  const retirementId = createHash("sha256")
    .update(`${deleteAfter}\n${candidates.join("\n")}`)
    .digest("hex")
    .slice(0, 24);
  state.retiredArtifacts.set(retirementId, {
    retirementId,
    objectKeys: candidates,
    deleteAfter,
  });
}

export function keepOnlyUnreferencedPhotoRetirements(
  state: PhotoRetirementState,
  periods: Map<string, PhotoPeriod>,
): void {
  for (const [photoId, entry] of state.retiredObjects) {
    const objectKeys = entry.objectKeys.filter(
      (key) => !isPhotoArtifactReferenced(periods, state.photoMonths, key),
    );
    if (objectKeys.length === 0 || state.photoMonths.has(photoId)) {
      state.retiredObjects.delete(photoId);
    } else if (objectKeys.length !== entry.objectKeys.length) {
      state.retiredObjects.set(photoId, { ...entry, objectKeys });
    }
  }

  for (const [retirementId, entry] of state.retiredArtifacts) {
    const objectKeys = entry.objectKeys.filter(
      (key) => !isPhotoArtifactReferenced(periods, state.photoMonths, key),
    );
    if (objectKeys.length === 0) {
      state.retiredArtifacts.delete(retirementId);
    } else if (objectKeys.length !== entry.objectKeys.length) {
      state.retiredArtifacts.set(retirementId, { ...entry, objectKeys });
    }
  }
}

export function isPhotoArtifactReferenced(
  periods: Map<string, PhotoPeriod>,
  photoMonths: Map<string, string>,
  key: string,
): boolean {
  if ([...periods.values()].some((period) => period.path === key)) {
    return true;
  }
  const photoId = photoIdFromMediaObjectKey(key);
  return photoId !== null && photoMonths.has(photoId);
}

function allRetiredObjectKeys(state: PhotoRetirementState): Set<string> {
  return new Set([
    ...[...state.retiredObjects.values()].flatMap((entry) => entry.objectKeys),
    ...[...state.retiredArtifacts.values()].flatMap((entry) => entry.objectKeys),
  ]);
}
