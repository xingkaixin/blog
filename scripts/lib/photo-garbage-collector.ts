import { randomBytes } from "node:crypto";
import { mapWithConcurrency } from "./concurrency";
import type { RetiredArtifactBatch, RetiredPhotoObjects } from "./photo-catalog-control";
import {
  loadPhotoCatalog,
  retryPhotoCatalogMutation,
  writePhotoCatalogControl,
} from "./photo-catalog-store";
import type { PhotoObjectStore } from "./photo-store";

const DELETE_CONCURRENCY = 8;
const GARBAGE_CLAIM_DURATION_MS = 60 * 60 * 1_000;

export type CollectPhotoGarbageOptions = {
  store: PhotoObjectStore;
  now?: () => Date;
};

export type CollectPhotoGarbageResult = {
  removedObjects: number;
  failedObjects: number;
  pendingPhotos: number;
  pendingArtifacts: number;
  failures: PhotoGarbageFailure[];
};

export type PhotoGarbageFailure = {
  objectKey: string;
  message: string;
};

type GarbageDeletionResult = { status: "removed" } | { status: "failed"; message: string };

type GarbageClaim = {
  id: string;
  photos: RetiredPhotoObjects[];
  artifacts: RetiredArtifactBatch[];
  pendingPhotos: number;
  pendingArtifacts: number;
};

export async function collectPhotoGarbage(
  options: CollectPhotoGarbageOptions,
): Promise<CollectPhotoGarbageResult> {
  const now = options.now?.() ?? new Date();
  const claimId = randomBytes(12).toString("hex");
  const claim = await retryPhotoCatalogMutation(() =>
    claimPhotoGarbage({ ...options, now: () => now }, claimId),
  );
  if (claim.photos.length === 0 && claim.artifacts.length === 0) {
    return {
      removedObjects: 0,
      failedObjects: 0,
      pendingPhotos: claim.pendingPhotos,
      pendingArtifacts: claim.pendingArtifacts,
      failures: [],
    };
  }

  const objectKeys = [
    ...new Set([
      ...claim.photos.flatMap((entry) => entry.objectKeys),
      ...claim.artifacts.flatMap((entry) => entry.objectKeys),
    ]),
  ];
  const deletionResults = new Map<string, GarbageDeletionResult>(
    await mapWithConcurrency(
      objectKeys,
      DELETE_CONCURRENCY,
      async (key): Promise<[string, GarbageDeletionResult]> => {
        try {
          await options.store.delete(key);
          return [key, { status: "removed" }];
        } catch (error) {
          return [
            key,
            {
              status: "failed",
              message: readableError(error),
            },
          ];
        }
      },
    ),
  );
  return retryPhotoCatalogMutation(() =>
    finishPhotoGarbageCollection(options.store, claim, deletionResults),
  );
}

export async function collectPhotoGarbageBestEffort(
  options: CollectPhotoGarbageOptions,
  warn: (message: string) => void = console.warn,
): Promise<void> {
  try {
    reportGarbageFailures(await collectPhotoGarbage(options), warn);
  } catch (error) {
    warn(`照片对象回收未完成: ${readableError(error)}`);
  }
}

async function claimPhotoGarbage(
  options: CollectPhotoGarbageOptions,
  claimId: string,
): Promise<GarbageClaim> {
  const now = options.now?.() ?? new Date();
  const catalog = await loadPhotoCatalog(options.store);
  const expiresAt = new Date(now.getTime() + GARBAGE_CLAIM_DURATION_MS).toISOString();
  const canClaim = (entry: RetiredPhotoObjects | RetiredArtifactBatch) =>
    Date.parse(entry.deleteAfter) <= now.getTime() &&
    (entry.deletion === undefined ||
      entry.deletion.id === claimId ||
      Date.parse(entry.deletion.expiresAt) <= now.getTime());
  const photos = [...catalog.retiredObjects.values()].filter(canClaim);
  const artifacts = [...catalog.retiredArtifacts.values()].filter(canClaim);
  for (const entry of [...photos, ...artifacts]) {
    entry.deletion = { id: claimId, expiresAt };
  }
  if (photos.length > 0 || artifacts.length > 0) {
    await writePhotoCatalogControl(options.store, catalog);
  }
  return {
    id: claimId,
    photos,
    artifacts,
    pendingPhotos: catalog.retiredObjects.size,
    pendingArtifacts: catalog.retiredArtifacts.size,
  };
}

async function finishPhotoGarbageCollection(
  store: PhotoObjectStore,
  claim: GarbageClaim,
  deletionResults: Map<string, GarbageDeletionResult>,
): Promise<CollectPhotoGarbageResult> {
  const catalog = await loadPhotoCatalog(store);
  finishClaimedEntries(
    claim.photos,
    catalog.retiredObjects,
    (entry) => entry.photoId,
    claim.id,
    deletionResults,
  );
  finishClaimedEntries(
    claim.artifacts,
    catalog.retiredArtifacts,
    (entry) => entry.retirementId,
    claim.id,
    deletionResults,
  );
  await writePhotoCatalogControl(store, catalog);
  const failures: PhotoGarbageFailure[] = [];
  for (const [objectKey, result] of deletionResults) {
    if (result.status === "failed") {
      failures.push({ objectKey, message: result.message });
    }
  }

  return {
    removedObjects: [...deletionResults.values()].filter((result) => result.status === "removed")
      .length,
    failedObjects: failures.length,
    pendingPhotos: catalog.retiredObjects.size,
    pendingArtifacts: catalog.retiredArtifacts.size,
    failures,
  };
}

function finishClaimedEntries<Entry extends RetiredPhotoObjects | RetiredArtifactBatch>(
  claimedEntries: Entry[],
  currentEntries: Map<string, Entry>,
  entryId: (entry: Entry) => string,
  claimId: string,
  deletionResults: Map<string, GarbageDeletionResult>,
): void {
  for (const claimed of claimedEntries) {
    const id = entryId(claimed);
    const current = currentEntries.get(id);
    if (current?.deletion?.id !== claimId) {
      continue;
    }
    const failedKeys = current.objectKeys.filter(
      (key) => deletionResults.get(key)?.status === "failed",
    );
    if (failedKeys.length === 0) {
      currentEntries.delete(id);
    } else {
      currentEntries.set(id, {
        ...current,
        objectKeys: failedKeys,
        deletion: undefined,
      });
    }
  }
}

function reportGarbageFailures(
  result: CollectPhotoGarbageResult,
  warn: (message: string) => void,
): void {
  for (const failure of result.failures) {
    warn(`照片对象回收失败 ${failure.objectKey}: ${failure.message}`);
  }
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
