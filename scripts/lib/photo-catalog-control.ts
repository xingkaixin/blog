import {
  PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
  PHOTO_VARIANT_WIDTHS,
  isPhotoId,
  parsePhotoCatalogIndex,
  type PhotoCatalogIndex,
} from "../../src/lib/photo-catalog";

export const PHOTO_CATALOG_CONTROL_KEY = "catalog/control.json";
export const PHOTO_CATALOG_CONTROL_SCHEMA_VERSION = 1 as const;

export type PhotoDeletionClaim = {
  id: string;
  expiresAt: string;
};

export type RetiredPhotoObjects = {
  photoId: string;
  objectKeys: string[];
  deleteAfter: string;
  deletion?: PhotoDeletionClaim;
};

export type RetiredArtifactBatch = {
  retirementId: string;
  objectKeys: string[];
  deleteAfter: string;
  deletion?: PhotoDeletionClaim;
};

export type PhotoCatalogControl = Omit<PhotoCatalogIndex, "schemaVersion"> & {
  schemaVersion: typeof PHOTO_CATALOG_CONTROL_SCHEMA_VERSION;
  retiredObjects: RetiredPhotoObjects[];
  retiredArtifacts: RetiredArtifactBatch[];
};

const PERIOD_PATH_PATTERN = /^catalog\/months\/\d{4}-(?:0[1-9]|1[0-2])\.[a-f0-9]{24}\.json$/;
const MEDIA_PATH_PATTERN = new RegExp(
  `^media/([a-f0-9]{32})/(?:${PHOTO_VARIANT_WIDTHS.join("|")})\\.webp$`,
);
const RETIREMENT_ID_PATTERN = /^[a-f0-9]{24}$/;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/;

export function parsePhotoCatalogControl(value: unknown): PhotoCatalogControl {
  const input = readRecord(value, "catalogControl");
  if (input.schemaVersion !== PHOTO_CATALOG_CONTROL_SCHEMA_VERSION) {
    throw new Error("不支持的照片后台控制文档版本");
  }
  return parseControlFields(input);
}

export function parseLegacyPhotoCatalogControl(value: unknown): PhotoCatalogControl {
  const input = readRecord(value, "catalog");
  if (input.schemaVersion !== 2) {
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

export function photoIdFromMediaObjectKey(key: string): string | null {
  return MEDIA_PATH_PATTERN.exec(key)?.[1] ?? null;
}

export function isPhotoArtifactKey(key: string): boolean {
  return PERIOD_PATH_PATTERN.test(key) || MEDIA_PATH_PATTERN.test(key);
}

function parseControlFields(input: Record<string, unknown>): PhotoCatalogControl {
  const index = parsePhotoCatalogIndex({
    ...input,
    schemaVersion: PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
  });
  const retiredObjects = readRetiredObjects(input.retiredObjects);
  const retiredArtifacts = readRetiredArtifacts(input.retiredArtifacts);
  validateRetirements(index, retiredObjects, retiredArtifacts);
  return {
    ...index,
    schemaVersion: PHOTO_CATALOG_CONTROL_SCHEMA_VERSION,
    retiredObjects,
    retiredArtifacts,
  };
}

function readRetiredObjects(value: unknown): RetiredPhotoObjects[] {
  if (!Array.isArray(value)) {
    throw new Error("catalogControl.retiredObjects 必须是数组");
  }
  const entries = value.map((item, index): RetiredPhotoObjects => {
    const field = `catalogControl.retiredObjects[${index}]`;
    const entry = readRecord(item, field);
    const photoId = readString(entry.photoId, `${field}.photoId`);
    const objectKeys = readObjectKeys(entry.objectKeys, `${field}.objectKeys`);
    if (!isPhotoId(photoId)) {
      throw new Error(`${field}.photoId 必须是 32 位十六进制内容 ID`);
    }
    for (const key of objectKeys) {
      const mediaPhotoId = photoIdFromMediaObjectKey(key);
      if (mediaPhotoId !== photoId && !PERIOD_PATH_PATTERN.test(key)) {
        throw new Error(`${field}.objectKeys 包含不属于照片 ${photoId} 的对象路径`);
      }
    }
    return {
      photoId,
      objectKeys,
      deleteAfter: readTimestamp(entry.deleteAfter, `${field}.deleteAfter`),
      deletion: readDeletionClaim(entry.deletion, `${field}.deletion`),
    };
  });
  assertUnique(
    entries.map((entry) => entry.photoId),
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
      deleteAfter: readTimestamp(entry.deleteAfter, `${field}.deleteAfter`),
      deletion: readDeletionClaim(entry.deletion, `${field}.deletion`),
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

function validateRetirements(
  index: PhotoCatalogIndex,
  retiredObjects: RetiredPhotoObjects[],
  retiredArtifacts: RetiredArtifactBatch[],
): void {
  for (const retired of retiredObjects) {
    if (index.photoMonths[retired.photoId]) {
      throw new Error(`照片 ${retired.photoId} 不能同时处于发布与待回收状态`);
    }
  }
  const retiredPhotoKeys = new Set(retiredObjects.flatMap((entry) => entry.objectKeys));
  const livePeriodPaths = new Set(index.periods.map((period) => period.path));
  for (const retired of retiredArtifacts) {
    for (const key of retired.objectKeys) {
      const photoId = photoIdFromMediaObjectKey(key);
      if (retiredPhotoKeys.has(key)) {
        throw new Error(`待回收对象 ${key} 不能同时属于照片与产物队列`);
      }
      if (livePeriodPaths.has(key) || (photoId !== null && index.photoMonths[photoId])) {
        throw new Error(`待回收产物 ${key} 仍被主 Catalog 引用`);
      }
    }
  }
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
  const match = ISO_TIMESTAMP_PATTERN.exec(timestamp);
  if (!match || !isValidTimestampParts(match) || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`${field} 必须是包含时区的 ISO 时间`);
  }
  return timestamp;
}

function isValidTimestampParts(match: RegExpExecArray): boolean {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    Number(match[4]) <= 23 &&
    Number(match[5]) <= 59 &&
    Number(match[6]) <= 59 &&
    Number(match[8] ?? 0) <= 23 &&
    Number(match[9] ?? 0) <= 59
  );
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
