import { randomBytes } from "node:crypto";
import { mapWithConcurrency } from "./concurrency";
import type { RetiredArtifactBatch } from "./photo-catalog-control";
import { editPhotoCatalog, type PhotoCatalogEditor } from "./photo-catalog-store";
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
  artifacts: RetiredArtifactBatch[];
  pendingArtifacts: number;
};

export async function collectPhotoGarbage(
  options: CollectPhotoGarbageOptions,
): Promise<CollectPhotoGarbageResult> {
  const claimId = randomBytes(12).toString("hex");
  const claim = await editPhotoCatalog(options.store, (catalog) =>
    claimPhotoGarbage(options, claimId, catalog),
  );
  if (claim.artifacts.length === 0) {
    return {
      removedObjects: 0,
      failedObjects: 0,
      pendingArtifacts: claim.pendingArtifacts,
      failures: [],
    };
  }

  const objectKeys = [...new Set(claim.artifacts.flatMap((entry) => entry.objectKeys))];
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
  return editPhotoCatalog(options.store, (catalog) =>
    finishPhotoGarbageCollection(catalog, claim, deletionResults),
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
  catalog: PhotoCatalogEditor,
): Promise<GarbageClaim> {
  const artifacts = await catalog.claimGarbage(
    claimId,
    options.now ?? (() => new Date()),
    GARBAGE_CLAIM_DURATION_MS,
  );
  return {
    id: claimId,
    artifacts,
    pendingArtifacts: catalog.pendingRetiredArtifacts,
  };
}

async function finishPhotoGarbageCollection(
  catalog: PhotoCatalogEditor,
  claim: GarbageClaim,
  deletionResults: Map<string, GarbageDeletionResult>,
): Promise<CollectPhotoGarbageResult> {
  const failedKeys = new Set(
    [...deletionResults]
      .filter(([, result]) => result.status === "failed")
      .map(([objectKey]) => objectKey),
  );
  await catalog.finishGarbage(claim.id, claim.artifacts, failedKeys);
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
    pendingArtifacts: catalog.pendingRetiredArtifacts,
    failures,
  };
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
