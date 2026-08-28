import { createHash } from "node:crypto";
import {
  isPhotoArtifactKey,
  monthFromPhotoMonthCatalogObjectKey,
  photoIdFromMediaObjectKey,
} from "../../src/lib/photo-artifact";
import {
  PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
  isPhotoId,
  parsePhotoCatalogContents,
  type PhotoAlbum,
  type PhotoCatalogContents,
  type PhotoCatalogIndex,
  type PhotoPeriod,
} from "../../src/lib/photo-catalog";
import { isPhotoTimestamp } from "../../src/lib/photo-timestamp";

export const PHOTO_CATALOG_CONTROL_KEY = "catalog/control.json";
export const PHOTO_CATALOG_CONTROL_SCHEMA_VERSION = 4 as const;

export type PhotoDeletionClaim = {
  id: string;
  expiresAt: string;
};

export type RetiredArtifactBatch = {
  retirementId: string;
  objectKeys: string[];
  deleteAfter: string | null;
  deletion?: PhotoDeletionClaim;
};

export type PhotoCatalogControl = {
  schemaVersion: typeof PHOTO_CATALOG_CONTROL_SCHEMA_VERSION;
  generatedAt: string;
  albums: PhotoAlbum[];
  periods: PhotoPeriod[];
  photoMonths: Record<string, string>;
  retiredArtifacts: RetiredArtifactBatch[];
};

const RETIREMENT_ID_PATTERN = /^[a-f0-9]{24}$/;

export function parsePhotoCatalogControl(value: unknown): PhotoCatalogControl {
  const input = readRecord(value, "catalogControl");
  if (
    input.schemaVersion !== 1 &&
    input.schemaVersion !== 2 &&
    input.schemaVersion !== 3 &&
    input.schemaVersion !== PHOTO_CATALOG_CONTROL_SCHEMA_VERSION
  ) {
    throw new Error("不支持的照片后台控制文档版本");
  }
  return parseControlFields(input);
}

export function parseLegacyPhotoCatalogControl(value: unknown): PhotoCatalogControl {
  const input = readRecord(value, "catalog");
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2) {
    throw new Error("无法从当前照片 Catalog 迁移后台控制状态");
  }
  return parseControlFields(input);
}

export function photoCatalogIndexFromControl(control: PhotoCatalogControl): PhotoCatalogIndex {
  return {
    schemaVersion: PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
    generatedAt: control.generatedAt,
    albums: control.albums,
    periods: control.periods,
    photoMonths: control.photoMonths,
  };
}

function parseControlFields(input: Record<string, unknown>): PhotoCatalogControl {
  const contents = parsePhotoCatalogContents(
    {
      generatedAt: input.generatedAt,
      albums: input.albums,
      periods: input.periods,
      photoMonths: input.photoMonths,
    },
    "catalogControl",
  );
  const retiredArtifacts = [
    ...(input.schemaVersion === PHOTO_CATALOG_CONTROL_SCHEMA_VERSION
      ? []
      : readRetiredObjects(input.retiredObjects)),
    ...readRetiredArtifacts(input.retiredArtifacts),
  ];
  validateRetirements(contents, retiredArtifacts);
  if (input.schemaVersion === 1 || input.schemaVersion === 2) {
    // 旧版本的时间从控制文档提交起算，不能证明公开索引的缓存已过期。
    for (const entry of retiredArtifacts) {
      entry.deleteAfter = null;
      entry.deletion = undefined;
    }
  }
  return {
    schemaVersion: PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
    ...contents,
    retiredArtifacts,
  };
}

function readRetiredObjects(value: unknown): RetiredArtifactBatch[] {
  if (!Array.isArray(value)) {
    throw new Error("catalogControl.retiredObjects 必须是数组");
  }
  const entries = value.map((item, index): RetiredArtifactBatch => {
    const field = `catalogControl.retiredObjects[${index}]`;
    const entry = readRecord(item, field);
    const photoId = readString(entry.photoId, `${field}.photoId`);
    const objectKeys = readObjectKeys(entry.objectKeys, `${field}.objectKeys`);
    if (!isPhotoId(photoId)) {
      throw new Error(`${field}.photoId 必须是 32 位十六进制内容 ID`);
    }
    for (const key of objectKeys) {
      const mediaPhotoId = photoIdFromMediaObjectKey(key);
      if (mediaPhotoId !== photoId && monthFromPhotoMonthCatalogObjectKey(key) === null) {
        throw new Error(`${field}.objectKeys 包含不属于照片 ${photoId} 的对象路径`);
      }
    }
    return {
      retirementId: artifactRetirementId(objectKeys),
      objectKeys,
      ...readRetirementSchedule(entry, field),
    };
  });
  assertUnique(
    entries.map((entry) => entry.retirementId),
    "catalogControl.retiredObjects",
  );
  return entries;
}

function readRetiredArtifacts(value: unknown): RetiredArtifactBatch[] {
  if (!Array.isArray(value)) {
    throw new Error("catalogControl.retiredArtifacts 必须是数组");
  }
  const entries = value.map((item, index): RetiredArtifactBatch => {
    const field = `catalogControl.retiredArtifacts[${index}]`;
    const entry = readRecord(item, field);
    const retirementId = readString(entry.retirementId, `${field}.retirementId`);
    if (!RETIREMENT_ID_PATTERN.test(retirementId)) {
      throw new Error(`${field}.retirementId 必须是 24 位十六进制 ID`);
    }
    const objectKeys = readObjectKeys(entry.objectKeys, `${field}.objectKeys`);
    if (objectKeys.some((key) => !isPhotoArtifactKey(key))) {
      throw new Error(`${field}.objectKeys 包含无效对象路径`);
    }
    return {
      retirementId,
      objectKeys,
      ...readRetirementSchedule(entry, field),
    };
  });
  assertUnique(
    entries.map((entry) => entry.retirementId),
    "catalogControl.retiredArtifacts",
  );
  assertUnique(
    entries.flatMap((entry) => entry.objectKeys),
    "catalogControl.retiredArtifacts.objectKeys",
  );
  return entries;
}

export function artifactRetirementId(keys: string[]): string {
  return createHash("sha256").update(keys.toSorted().join("\n")).digest("hex").slice(0, 24);
}

function validateRetirements(
  index: PhotoCatalogContents,
  retiredArtifacts: RetiredArtifactBatch[],
): void {
  assertUnique(
    retiredArtifacts.map((entry) => entry.retirementId),
    "catalogControl.retiredArtifacts",
  );
  assertUnique(
    retiredArtifacts.flatMap((entry) => entry.objectKeys),
    "catalogControl.retiredArtifacts.objectKeys",
  );
  const livePeriodPaths = new Set(index.periods.map((period) => period.path));
  for (const retired of retiredArtifacts) {
    for (const key of retired.objectKeys) {
      if (livePeriodPaths.has(key)) {
        throw new Error(`待回收产物 ${key} 仍被主 Catalog 引用`);
      }
    }
  }
}

function readRetirementSchedule(entry: Record<string, unknown>, field: string) {
  const deleteAfter =
    entry.deleteAfter === null ? null : readTimestamp(entry.deleteAfter, `${field}.deleteAfter`);
  const deletion = readDeletionClaim(entry.deletion, `${field}.deletion`);
  if (deleteAfter === null && deletion !== undefined) {
    throw new Error(`${field} 尚未确认公开索引，不能领取回收任务`);
  }
  return { deleteAfter, deletion };
}

function readDeletionClaim(value: unknown, field: string): PhotoDeletionClaim | undefined {
  if (value === undefined) {
    return undefined;
  }
  const claim = readRecord(value, field);
  const id = readString(claim.id, `${field}.id`);
  if (!RETIREMENT_ID_PATTERN.test(id)) {
    throw new Error(`${field}.id 必须是 24 位十六进制 ID`);
  }
  return {
    id,
    expiresAt: readTimestamp(claim.expiresAt, `${field}.expiresAt`),
  };
}

function readObjectKeys(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} 必须是数组`);
  }
  const keys = value.map((item, index) => readString(item, `${field}[${index}]`));
  if (keys.length === 0) {
    throw new Error(`${field} 不能为空`);
  }
  assertUnique(keys, field);
  return keys;
}

function readTimestamp(value: unknown, field: string): string {
  const timestamp = readString(value, field);
  if (!isPhotoTimestamp(timestamp)) {
    throw new Error(`${field} 必须是包含时区的 ISO 时间`);
  }
  return timestamp;
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${field} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} 必须是字符串`);
  }
  return value;
}

function assertUnique(values: string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${field} 不能包含重复值`);
  }
}
