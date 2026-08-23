import { createHash } from "node:crypto";
import {
  PHOTO_CATALOG_INDEX_KEY,
  PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
  PHOTO_VARIANT_WIDTHS,
  comparePhotosNewestFirst,
  parsePhotoCatalogIndexWithVersion,
  parsePhotoMonthCatalog,
  photoAlbumCounts,
  validatePhotoMonth,
  type PhotoAlbum,
  type PhotoCatalogIndex,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
  type ParsedPhotoCatalogIndex,
} from "../../src/lib/photo-catalog";
import { mapWithConcurrency } from "./concurrency";
import {
  PHOTO_CATALOG_CONTROL_KEY,
  parseLegacyPhotoCatalogControl,
  parsePhotoCatalogControl,
  photoCatalogIndexFromControl,
  type PhotoCatalogControl,
  type RetiredArtifactBatch,
  type RetiredPhotoObjects,
} from "./photo-catalog-control";
import { PhotoCatalogState } from "./photo-catalog-state";
import { PhotoStoreConflictError, type PhotoObjectStore } from "./photo-store";

const SHARD_CACHE_CONTROL = "public, max-age=31536000, immutable";
const INDEX_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=86400";
const CONTROL_CACHE_CONTROL = "no-store";
const READ_CONCURRENCY = 8;
const WRITE_CONCURRENCY = 2;
const CATALOG_COMMIT_ATTEMPTS = 5;

export type PhotoCatalogPhotoStatus = "published" | "retired" | "new";

export type PhotoCatalogCommitResult = {
  catalogChanged: boolean;
  updatedPeriods: number;
};

export class PhotoCatalogEditor {
  private constructor(
    private readonly store: PhotoObjectStore,
    private readonly state: PhotoCatalogState,
  ) {}

  static async load(store: PhotoObjectStore): Promise<PhotoCatalogEditor> {
    return new PhotoCatalogEditor(store, await loadPhotoCatalog(store));
  }

  get generatedAt(): string | null {
    return this.state.generatedAt;
  }

  get pendingRetiredPhotos(): number {
    return this.state.pendingRetiredPhotos;
  }

  get pendingRetiredArtifacts(): number {
    return this.state.pendingRetiredArtifacts;
  }

  album(albumId: string): PhotoAlbum | undefined {
    return this.state.album(albumId);
  }

  upsertAlbum(album: PhotoAlbum): boolean {
    return this.state.upsertAlbum(album);
  }

  async inspectPhotos(photoIds: Iterable<string>): Promise<Map<string, PhotoCatalogPhotoStatus>> {
    const ids = [...new Set(photoIds)];
    await loadPhotoCatalogMonths(
      this.store,
      this.state,
      ids.flatMap((photoId) => this.state.photoMonth(photoId) ?? []),
    );
    return new Map(
      ids.map((photoId) => [
        photoId,
        this.state.isPhotoRetired(photoId)
          ? "retired"
          : this.state.photoMonth(photoId)
            ? "published"
            : "new",
      ]),
    );
  }

  async addPhotoToAlbum(photoId: string, albumId: string): Promise<boolean> {
    const month = this.state.photoMonth(photoId);
    await loadPhotoCatalogMonths(this.store, this.state, month ? [month] : []);
    return this.state.addPhotoToAlbum(photoId, albumId);
  }

  async addPhotos(photos: PhotoRecord[]): Promise<void> {
    await loadPhotoCatalogMonths(
      this.store,
      this.state,
      photos.map((photo) => photo.capturedAt.slice(0, 7)),
    );
    for (const photo of photos) {
      this.state.addPhoto(photo);
    }
  }

  async retirePhotos(photoIds: string[], deleteAfter: string): Promise<Set<string>> {
    await loadPhotoCatalogMonths(
      this.store,
      this.state,
      photoIds.flatMap((photoId) => this.state.photoMonth(photoId) ?? []),
    );
    return this.state.retirePhotos(photoIds, deleteAfter);
  }

  assertArtifactsWritable(photoIds: Iterable<string>): void {
    const claimedKeys = this.state.claimedArtifactKeys();
    for (const photoId of photoIds) {
      for (const width of PHOTO_VARIANT_WIDTHS) {
        const key = `media/${photoId}/${width}.webp`;
        if (claimedKeys.has(key)) {
          throw new Error(`照片对象 ${key} 正在回收，请稍后重试`);
        }
      }
    }
  }

  async commit(
    generatedAt: Date,
    attemptedArtifacts: Set<string> = new Set(),
    writtenArtifacts: Set<string> = new Set(),
  ): Promise<PhotoCatalogCommitResult> {
    const updatedPeriods = this.state.dirtyMonths().length;
    const domainChanged =
      this.state.domainChanged ||
      this.state.hasUnreferencedArtifacts(this.state.periods(), attemptedArtifacts);
    const catalogChanged = domainChanged || !this.state.publicIndexCurrent;
    if (domainChanged) {
      await writePhotoCatalog(
        this.store,
        this.state,
        generatedAt,
        attemptedArtifacts,
        writtenArtifacts,
      );
    } else if (!this.state.publicIndexCurrent) {
      await writePhotoCatalogIndex(this.store, this.state);
    }
    return { catalogChanged, updatedPeriods };
  }

  async repairPublicIndex(): Promise<boolean> {
    if (this.state.generatedAt === null) {
      throw new Error("无法迁移空的照片 Catalog");
    }
    if (this.state.controlVersion !== null && this.state.publicIndexCurrent) {
      return false;
    }
    await writePhotoCatalogIndex(this.store, this.state);
    return true;
  }

  async claimGarbage(
    claimId: string,
    now: Date,
    expiresAt: string,
  ): Promise<{ photos: RetiredPhotoObjects[]; artifacts: RetiredArtifactBatch[] }> {
    const claim = this.state.claimGarbage(claimId, now, expiresAt);
    if (claim.photos.length > 0 || claim.artifacts.length > 0) {
      await writePhotoCatalogControl(this.store, this.state);
    }
    return claim;
  }

  async finishGarbage(
    claimId: string,
    photos: RetiredPhotoObjects[],
    artifacts: RetiredArtifactBatch[],
    failedKeys: Set<string>,
  ): Promise<void> {
    this.state.finishGarbageClaim(claimId, photos, artifacts, failedKeys);
    await writePhotoCatalogControl(this.store, this.state);
  }
}

export async function editPhotoCatalog<T>(
  store: PhotoObjectStore,
  operation: (catalog: PhotoCatalogEditor) => Promise<T>,
): Promise<T> {
  return retryPhotoCatalogMutation(async () => operation(await PhotoCatalogEditor.load(store)));
}

async function loadPhotoCatalog(store: PhotoObjectStore): Promise<PhotoCatalogState> {
  const [controlObject, indexObject] = await Promise.all([
    store.getText(PHOTO_CATALOG_CONTROL_KEY),
    store.getText(PHOTO_CATALOG_INDEX_KEY),
  ]);
  const rawIndex = indexObject ? parseJson(indexObject.text, PHOTO_CATALOG_INDEX_KEY) : null;
  const control = controlObject
    ? parsePhotoCatalogControl(parseJson(controlObject.text, PHOTO_CATALOG_CONTROL_KEY))
    : rawIndex
      ? parseLegacyPhotoCatalogControl(rawIndex)
      : null;
  let parsedPublicIndex: ParsedPhotoCatalogIndex | null = null;
  if (rawIndex) {
    try {
      parsedPublicIndex = parsePhotoCatalogIndexWithVersion(rawIndex);
    } catch (error) {
      if (!controlObject) {
        throw error;
      }
    }
  }

  if (!control) {
    return PhotoCatalogState.empty();
  }

  const expectedPublicIndex = photoCatalogIndexFromControl(control);
  return PhotoCatalogState.loaded(control, {
    control: controlObject?.version ?? null,
    publicIndex: indexObject?.version ?? null,
    publicIndexCurrent:
      parsedPublicIndex?.sourceVersion === PHOTO_CATALOG_INDEX_SCHEMA_VERSION &&
      JSON.stringify(parsedPublicIndex.index) === JSON.stringify(expectedPublicIndex),
  });
}

async function loadPhotoCatalogMonths(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
  months: Iterable<string>,
): Promise<void> {
  if (catalog.generatedAt === null) {
    return;
  }
  const periods = [...new Set(months)]
    .filter((month) => !catalog.hasLoadedMonth(month))
    .map((month) => catalog.period(month))
    .filter((period): period is PhotoPeriod => Boolean(period));
  const index = photoCatalogIndexFromControl(catalog.currentControl());
  const loadedMonths = await readPhotoCatalogMonths(store, index, periods);
  for (const { shard } of loadedMonths) {
    catalog.loadMonth(shard);
  }
}

async function writePhotoCatalog(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
  generatedAt: Date,
  attemptedArtifacts: Set<string> = new Set(),
  writtenArtifacts: Set<string> = new Set(),
): Promise<void> {
  const nextPeriods = catalog.periods();
  const claimedArtifactKeys = catalog.claimedArtifactKeys();

  await mapWithConcurrency(catalog.dirtyMonths(), WRITE_CONCURRENCY, async (month) => {
    const shard = catalog.monthForWrite(month);
    if (!shard) {
      throw new Error(`缺少待写入的月份 ${month}`);
    }
    if (shard.photos.length === 0) {
      nextPeriods.delete(month);
      return;
    }
    shard.photos.sort(comparePhotosNewestFirst);
    const validatedShard = parsePhotoMonthCatalog(shard);
    const body = serializeJson(validatedShard);
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 24);
    const key = `catalog/months/${month}.${hash}.json`;
    if (claimedArtifactKeys.has(key)) {
      throw new Error(`照片对象 ${key} 正在回收，请稍后重试`);
    }
    if (!writtenArtifacts.has(key)) {
      attemptedArtifacts.add(key);
      await store.put(key, body, {
        contentType: "application/json; charset=utf-8",
        cacheControl: SHARD_CACHE_CONTROL,
      });
      writtenArtifacts.add(key);
    }
    nextPeriods.set(month, {
      month,
      count: validatedShard.photos.length,
      albumCounts: photoAlbumCounts(validatedShard.photos),
      path: key,
    });
  });

  const control = catalog.prepareControl(nextPeriods, generatedAt, attemptedArtifacts);
  await writeControlDocument(store, catalog, control);
  await writePublicIndex(store, catalog, photoCatalogIndexFromControl(control));
}

async function writePhotoCatalogControl(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
): Promise<void> {
  if (catalog.generatedAt === null) {
    throw new Error("无法写入空的照片 Catalog 控制状态");
  }
  await writeControlDocument(store, catalog, catalog.currentControl());
}

async function writePhotoCatalogIndex(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
): Promise<void> {
  if (catalog.generatedAt === null) {
    throw new Error("无法发布空的照片 Catalog 投影");
  }
  if (catalog.controlVersion === null) {
    await writeControlDocument(store, catalog, catalog.currentControl());
  }
  const index = photoCatalogIndexFromControl(catalog.currentControl());
  await writePublicIndex(store, catalog, index);
}

export async function migratePhotoCatalog(store: PhotoObjectStore): Promise<boolean> {
  return editPhotoCatalog(store, (catalog) => catalog.repairPublicIndex());
}

async function writePublicIndex(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
  index: PhotoCatalogIndex,
): Promise<void> {
  const version = await store.put(PHOTO_CATALOG_INDEX_KEY, serializeJson(index), {
    contentType: "application/json; charset=utf-8",
    cacheControl: INDEX_CACHE_CONTROL,
    expectedVersion: catalog.publicIndexVersion,
  });
  catalog.recordPublicIndexWrite(version);
}

async function writeControlDocument(
  store: PhotoObjectStore,
  catalog: PhotoCatalogState,
  control: PhotoCatalogControl,
): Promise<void> {
  const version = await store.put(PHOTO_CATALOG_CONTROL_KEY, serializeJson(control), {
    contentType: "application/json; charset=utf-8",
    cacheControl: CONTROL_CACHE_CONTROL,
    expectedVersion: catalog.controlVersion,
  });
  catalog.recordControlWrite(version, control);
}

async function retryPhotoCatalogMutation<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= CATALOG_COMMIT_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof PhotoStoreConflictError) || attempt === CATALOG_COMMIT_ATTEMPTS) {
        throw error;
      }
    }
  }
  throw new Error("照片 Catalog 提交重试次数耗尽");
}

async function readPhotoCatalogMonths(
  store: PhotoObjectStore,
  index: PhotoCatalogIndex,
  periods: PhotoPeriod[],
): Promise<Array<{ period: PhotoPeriod; shard: PhotoMonthCatalog }>> {
  return mapWithConcurrency(periods, READ_CONCURRENCY, async (period) => {
    const shardObject = await store.getText(period.path);
    if (!shardObject) {
      throw new Error(`Catalog 引用了不存在的月份索引 ${period.path}`);
    }
    const shard = parsePhotoMonthCatalog(parseJson(shardObject.text, period.path));
    validatePhotoMonth(index, period, shard);
    return { period, shard };
  });
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJson(value: string, key: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`对象 ${key} 不是有效的 JSON`);
  }
}
