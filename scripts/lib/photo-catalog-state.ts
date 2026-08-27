import { createHash } from "node:crypto";
import {
  isPhotoArtifactKey,
  photoIdFromMediaObjectKey,
  photoMediaObjectKey,
} from "../../src/lib/photo-artifact";
import {
  PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
  PHOTO_VARIANT_WIDTHS,
  monthFromCapturedAt,
  type PhotoAlbum,
  type PhotoMonthCatalog,
  type PhotoPeriod,
  type PhotoRecord,
} from "../../src/lib/photo-catalog";
import {
  PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
  parsePhotoCatalogControl,
  type PhotoCatalogControl,
  type PhotoDeletionClaim,
  type RetiredArtifactBatch,
  type RetiredPhotoObjects,
} from "./photo-catalog-control";

type PhotoCatalogStateOptions = {
  generatedAt: string | null;
  controlVersion: string | null;
  publicIndexVersion: string | null;
  publicIndexCurrent: boolean;
  albums?: Iterable<PhotoAlbum>;
  periods?: Iterable<PhotoPeriod>;
  photoMonths?: Iterable<readonly [string, string]>;
  retiredObjects?: Iterable<RetiredPhotoObjects>;
  retiredArtifacts?: Iterable<RetiredArtifactBatch>;
};

export class PhotoCatalogState {
  #generatedAt: string | null;
  #controlVersion: string | null;
  #publicIndexVersion: string | null;
  #publicIndexCurrent: boolean;
  #albums: Map<string, PhotoAlbum>;
  #months = new Map<string, PhotoMonthCatalog>();
  #periods: Map<string, PhotoPeriod>;
  #photoMonths: Map<string, string>;
  #retiredObjects: Map<string, RetiredPhotoObjects>;
  #retiredArtifacts: Map<string, RetiredArtifactBatch>;
  #dirtyMonths = new Set<string>();
  #domainChanged = false;

  private constructor(options: PhotoCatalogStateOptions) {
    this.#generatedAt = options.generatedAt;
    this.#controlVersion = options.controlVersion;
    this.#publicIndexVersion = options.publicIndexVersion;
    this.#publicIndexCurrent = options.publicIndexCurrent;
    this.#albums = new Map([...(options.albums ?? [])].map((album) => [album.id, album]));
    this.#periods = new Map([...(options.periods ?? [])].map((period) => [period.month, period]));
    this.#photoMonths = new Map(options.photoMonths);
    this.#retiredObjects = new Map(
      [...(options.retiredObjects ?? [])].map((entry) => [entry.photoId, entry]),
    );
    this.#retiredArtifacts = new Map(
      [...(options.retiredArtifacts ?? [])].map((entry) => [entry.retirementId, entry]),
    );
  }

  static empty(): PhotoCatalogState {
    return new PhotoCatalogState({
      generatedAt: null,
      controlVersion: null,
      publicIndexVersion: null,
      publicIndexCurrent: true,
    });
  }

  static loaded(
    control: PhotoCatalogControl,
    versions: {
      control: string | null;
      publicIndex: string | null;
      publicIndexCurrent: boolean;
    },
  ): PhotoCatalogState {
    return new PhotoCatalogState({
      generatedAt: control.generatedAt,
      controlVersion: versions.control,
      publicIndexVersion: versions.publicIndex,
      publicIndexCurrent: versions.publicIndexCurrent,
      albums: control.albums,
      periods: control.periods,
      photoMonths: Object.entries(control.photoMonths),
      retiredObjects: control.retiredObjects,
      retiredArtifacts: control.retiredArtifacts,
    });
  }

  get generatedAt(): string | null {
    return this.#generatedAt;
  }

  get controlVersion(): string | null {
    return this.#controlVersion;
  }

  get publicIndexVersion(): string | null {
    return this.#publicIndexVersion;
  }

  get publicIndexCurrent(): boolean {
    return this.#publicIndexCurrent;
  }

  get domainChanged(): boolean {
    return this.#domainChanged;
  }

  get pendingRetiredPhotos(): number {
    return this.#retiredObjects.size;
  }

  get pendingRetiredArtifacts(): number {
    return this.#retiredArtifacts.size;
  }

  period(month: string): PhotoPeriod | undefined {
    const period = this.#periods.get(month);
    return period && copyPeriod(period);
  }

  periods(): Map<string, PhotoPeriod> {
    return new Map([...this.#periods].map(([month, period]) => [month, copyPeriod(period)]));
  }

  photoMonth(photoId: string): string | undefined {
    return this.#photoMonths.get(photoId);
  }

  isPhotoRetired(photoId: string): boolean {
    return this.#retiredObjects.has(photoId);
  }

  album(albumId: string): PhotoAlbum | undefined {
    const album = this.#albums.get(albumId);
    return album && { ...album };
  }

  upsertAlbum(album: PhotoAlbum): boolean {
    const current = this.#albums.get(album.id);
    if (current?.title === album.title) {
      return false;
    }
    this.#albums.set(album.id, album);
    this.#domainChanged = true;
    return true;
  }

  loadMonth(month: PhotoMonthCatalog): void {
    this.#months.set(month.month, {
      schemaVersion: PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
      month: month.month,
      photos: month.photos.map(copyPhoto),
    });
  }

  hasLoadedMonth(month: string): boolean {
    return this.#months.has(month);
  }

  monthForWrite(month: string): PhotoMonthCatalog | undefined {
    const catalog = this.#months.get(month);
    return catalog
      ? {
          schemaVersion: PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
          month: catalog.month,
          photos: catalog.photos.map(copyPhoto),
        }
      : undefined;
  }

  addPhotoToAlbum(photoId: string, albumId: string): boolean {
    const month = this.#photoMonths.get(photoId);
    if (!month) {
      throw new Error(`Catalog 中不存在照片 ${photoId}`);
    }
    const photo = this.#months.get(month)?.photos.find((candidate) => candidate.id === photoId);
    if (!photo) {
      throw new Error(`照片 ${photoId} 所属月份 ${month} 尚未加载或内容不完整`);
    }
    if (photo.albumIds.includes(albumId)) {
      return false;
    }
    photo.albumIds = [...photo.albumIds, albumId].toSorted();
    this.markMonthDirty(month);
    return true;
  }

  addPhoto(photo: PhotoRecord): void {
    const month = monthFromCapturedAt(photo.capturedAt);
    const monthCatalog = this.#months.get(month) ?? {
      schemaVersion: PHOTO_MONTH_CATALOG_SCHEMA_VERSION,
      month,
      photos: [],
    };
    monthCatalog.photos.push(copyPhoto(photo));
    this.#months.set(month, monthCatalog);
    this.#photoMonths.set(photo.id, month);
    this.markMonthDirty(month);
  }

  retirePhotos(photoIds: string[], deleteAfter: string): Set<string> {
    const targets = photoIds.map((photoId) => {
      const month = this.#photoMonths.get(photoId);
      const photo = month
        ? this.#months.get(month)?.photos.find((item) => item.id === photoId)
        : undefined;
      if (!month || !photo) {
        throw new Error(`Catalog 中不存在照片 ${photoId}`);
      }
      return { month, photo };
    });
    const objectKeys = new Set<string>();
    for (const { month, photo } of targets) {
      const monthCatalog = this.#months.get(month);
      if (!monthCatalog) {
        throw new Error(`缺少照片 ${photo.id} 所属月份 ${month}`);
      }
      monthCatalog.photos = monthCatalog.photos.filter((item) => item.id !== photo.id);
      this.#photoMonths.delete(photo.id);
      this.markMonthDirty(month);

      const oldPeriodPath = this.#periods.get(month)?.path;
      if (oldPeriodPath) {
        objectKeys.add(oldPeriodPath);
      }
      const photoObjectKeys = PHOTO_VARIANT_WIDTHS.map((width) =>
        photoMediaObjectKey(photo.id, width, photo.mediaRevision),
      ).toSorted();
      this.#retiredObjects.set(photo.id, {
        photoId: photo.id,
        objectKeys: photoObjectKeys,
        deleteAfter,
      });
      for (const key of photoObjectKeys) {
        objectKeys.add(key);
      }
    }
    return objectKeys;
  }

  dirtyMonths(): string[] {
    return [...this.#dirtyMonths];
  }

  hasUnreferencedArtifacts(
    periods: Map<string, PhotoPeriod>,
    objectKeys: Iterable<string>,
  ): boolean {
    const keys = [...objectKeys];
    const retiredKeys = this.allRetiredObjectKeys();
    const referencedKeys = this.referencedArtifactKeys(periods, keys);
    return keys.some((key) => !retiredKeys.has(key) && !referencedKeys.has(key));
  }

  monthsForArtifacts(objectKeys: Iterable<string>): string[] {
    return [
      ...new Set(
        [...objectKeys].flatMap((key) => {
          const photoId = photoIdFromMediaObjectKey(key);
          return photoId === null ? [] : (this.#photoMonths.get(photoId) ?? []);
        }),
      ),
    ];
  }

  assertArtifactsUnreferenced(objectKeys: string[]): void {
    const referencedKeys = this.referencedArtifactKeys(this.#periods, objectKeys);
    for (const key of objectKeys) {
      if (referencedKeys.has(key)) {
        throw new Error(`待回收对象 ${key} 仍被主 Catalog 引用`);
      }
    }
  }

  prepareControl(
    periods: Map<string, PhotoPeriod>,
    generatedAt: Date,
    attemptedArtifacts: Iterable<string>,
  ): PhotoCatalogControl {
    const replacedPeriodPaths = [...this.#periods]
      .filter(([month, period]) => periods.get(month)?.path !== period.path)
      .map(([, period]) => period.path);
    this.retireUnreferencedArtifacts(
      periods,
      new Set([...attemptedArtifacts, ...replacedPeriodPaths]),
      generatedAt,
    );
    this.removeEmptyAlbums(periods);
    return this.buildControl(periods, generatedAt.toISOString());
  }

  currentControl(): PhotoCatalogControl {
    if (this.#generatedAt === null) {
      throw new Error("照片 Catalog 尚未初始化");
    }
    return this.buildControl(this.#periods, this.#generatedAt);
  }

  recordControlWrite(version: string, control: PhotoCatalogControl): void {
    this.#controlVersion = version;
    this.#generatedAt = control.generatedAt;
    this.#periods = new Map(control.periods.map((period) => [period.month, period]));
    this.#dirtyMonths.clear();
    this.#domainChanged = false;
  }

  recordPublicIndexWrite(version: string): void {
    this.#publicIndexVersion = version;
    this.#publicIndexCurrent = true;
  }

  claimGarbage(
    claimId: string,
    now: Date,
    expiresAt: string,
  ): { photos: RetiredPhotoObjects[]; artifacts: RetiredArtifactBatch[] } {
    const claim = { id: claimId, expiresAt } satisfies PhotoDeletionClaim;
    const canClaim = (entry: RetiredPhotoObjects | RetiredArtifactBatch) =>
      Date.parse(entry.deleteAfter) <= now.getTime() &&
      (entry.deletion === undefined ||
        entry.deletion.id === claimId ||
        Date.parse(entry.deletion.expiresAt) <= now.getTime());
    const photos = [...this.#retiredObjects.values()].filter(canClaim);
    const artifacts = [...this.#retiredArtifacts.values()].filter(canClaim);
    for (const entry of [...photos, ...artifacts]) {
      entry.deletion = { ...claim };
    }
    return { photos: photos.map(copyRetiredPhoto), artifacts: artifacts.map(copyRetiredArtifact) };
  }

  finishGarbageClaim(
    claimId: string,
    claimedPhotos: RetiredPhotoObjects[],
    claimedArtifacts: RetiredArtifactBatch[],
    failedKeys: Set<string>,
  ): void {
    this.finishClaimedEntries(
      claimedPhotos,
      this.#retiredObjects,
      (entry) => entry.photoId,
      claimId,
      failedKeys,
    );
    this.finishClaimedEntries(
      claimedArtifacts,
      this.#retiredArtifacts,
      (entry) => entry.retirementId,
      claimId,
      failedKeys,
    );
  }

  private markMonthDirty(month: string): void {
    this.#dirtyMonths.add(month);
    this.#domainChanged = true;
  }

  private retireUnreferencedArtifacts(
    periods: Map<string, PhotoPeriod>,
    objectKeys: Iterable<string>,
    retiredAt: Date,
  ): void {
    const keys = [...objectKeys];
    const retiredKeys = this.allRetiredObjectKeys();
    const referencedKeys = this.referencedArtifactKeys(periods, keys);
    const candidates = keys
      .filter((key) => {
        if (!isPhotoArtifactKey(key)) {
          throw new Error(`无法回收未知的照片对象路径 ${key}`);
        }
        return !retiredKeys.has(key) && !referencedKeys.has(key);
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
    this.#retiredArtifacts.set(retirementId, {
      retirementId,
      objectKeys: candidates,
      deleteAfter,
    });
    this.#domainChanged = true;
  }

  private removeEmptyAlbums(periods: Map<string, PhotoPeriod>): void {
    const referencedAlbums = new Set(
      [...periods.values()].flatMap((period) => Object.keys(period.albumCounts)),
    );
    for (const albumId of this.#albums.keys()) {
      if (!referencedAlbums.has(albumId)) {
        this.#albums.delete(albumId);
      }
    }
  }

  private buildControl(
    periods: Map<string, PhotoPeriod>,
    generatedAt: string,
  ): PhotoCatalogControl {
    return parsePhotoCatalogControl({
      schemaVersion: PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
      generatedAt,
      albums: [...this.#albums.values()].toSorted((left, right) => left.id.localeCompare(right.id)),
      periods: [...periods.values()].toSorted((left, right) =>
        right.month.localeCompare(left.month),
      ),
      photoMonths: Object.fromEntries(
        [...this.#photoMonths].toSorted(([left], [right]) => left.localeCompare(right)),
      ),
      retiredObjects: [...this.#retiredObjects.values()].toSorted(
        (left, right) =>
          left.deleteAfter.localeCompare(right.deleteAfter) ||
          left.photoId.localeCompare(right.photoId),
      ),
      retiredArtifacts: [...this.#retiredArtifacts.values()].toSorted(
        (left, right) =>
          left.deleteAfter.localeCompare(right.deleteAfter) ||
          left.retirementId.localeCompare(right.retirementId),
      ),
    });
  }

  private referencedArtifactKeys(
    periods: Map<string, PhotoPeriod>,
    objectKeys: string[],
  ): Set<string> {
    const keys = periodPaths(periods);
    for (const month of this.monthsForArtifacts(objectKeys)) {
      const catalog = this.#months.get(month);
      if (!catalog) {
        throw new Error(`月份 ${month} 尚未加载，无法确认图片引用`);
      }
      for (const photo of catalog.photos) {
        for (const width of PHOTO_VARIANT_WIDTHS) {
          keys.add(photoMediaObjectKey(photo.id, width, photo.mediaRevision));
        }
      }
    }
    return keys;
  }

  private allRetiredObjectKeys(): Set<string> {
    return new Set([
      ...[...this.#retiredObjects.values()].flatMap((entry) => entry.objectKeys),
      ...[...this.#retiredArtifacts.values()].flatMap((entry) => entry.objectKeys),
    ]);
  }

  private finishClaimedEntries<Entry extends RetiredPhotoObjects | RetiredArtifactBatch>(
    claimedEntries: Entry[],
    currentEntries: Map<string, Entry>,
    entryId: (entry: Entry) => string,
    claimId: string,
    failedKeys: Set<string>,
  ): void {
    for (const claimed of claimedEntries) {
      const id = entryId(claimed);
      const current = currentEntries.get(id);
      if (current?.deletion?.id !== claimId) {
        continue;
      }
      const remainingKeys = current.objectKeys.filter((key) => failedKeys.has(key));
      if (remainingKeys.length === 0) {
        currentEntries.delete(id);
      } else {
        currentEntries.set(id, { ...current, objectKeys: remainingKeys, deletion: undefined });
      }
    }
  }
}

function periodPaths(periods: Map<string, PhotoPeriod>): Set<string> {
  return new Set([...periods.values()].map((period) => period.path));
}

export function photoRetirementDeadline(retiredAt: Date): string {
  return new Date(retiredAt.getTime() + 25 * 60 * 60 * 1_000).toISOString();
}

function copyPhoto(photo: PhotoRecord): PhotoRecord {
  return { ...photo, albumIds: [...photo.albumIds] };
}

function copyPeriod(period: PhotoPeriod): PhotoPeriod {
  return { ...period, albumCounts: { ...period.albumCounts } };
}

function copyRetiredPhoto(entry: RetiredPhotoObjects): RetiredPhotoObjects {
  return {
    ...entry,
    objectKeys: [...entry.objectKeys],
    deletion: entry.deletion && { ...entry.deletion },
  };
}

function copyRetiredArtifact(entry: RetiredArtifactBatch): RetiredArtifactBatch {
  return {
    ...entry,
    objectKeys: [...entry.objectKeys],
    deletion: entry.deletion && { ...entry.deletion },
  };
}
