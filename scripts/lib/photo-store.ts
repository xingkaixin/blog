import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { PHOTO_CATALOG_CONTROL_KEY, parsePhotoCatalogControl } from "./photo-catalog-control";

export type PhotoObjectBody = string | Uint8Array;

export type PutPhotoObjectOptions = {
  contentType: string;
  cacheControl: string;
  expectedVersion?: string | null;
};

export type PhotoTextObject = {
  text: string;
  version: string;
};

export interface PhotoObjectStore {
  getText(key: string): Promise<PhotoTextObject | null>;
  put(key: string, body: PhotoObjectBody, options: PutPhotoObjectOptions): Promise<string>;
  delete(key: string): Promise<void>;
  close?(): void;
}

export class PhotoStoreConflictError extends Error {
  constructor(key: string) {
    super(`对象 ${key} 已被其他写入更新`);
    this.name = "PhotoStoreConflictError";
  }
}

export type R2PhotoStoreOptions = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  controlBucket: string;
};

export type R2PhotoClient = Pick<S3Client, "send" | "destroy">;

type R2Environment = Readonly<Record<string, string | undefined>>;

type R2EnvironmentKey =
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_PHOTO_BUCKET"
  | "R2_PHOTO_CONTROL_BUCKET";

function resolveObjectPath(rootDirectory: string, key: string): string {
  const root = path.resolve(rootDirectory);
  const target = path.resolve(root, key);
  const relative = path.relative(root, target);

  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`无效的对象 key: ${key}`);
  }

  return target;
}

export class FilePhotoObjectStore implements PhotoObjectStore {
  readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  async getText(key: string): Promise<PhotoTextObject | null> {
    try {
      const target = await resolveSafeObjectPath(this.rootDirectory, key, false);
      const text = await fs.readFile(target, "utf8");
      return { text, version: objectVersion(text) };
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async put(key: string, body: PhotoObjectBody, options: PutPhotoObjectOptions): Promise<string> {
    const target = await resolveSafeObjectPath(this.rootDirectory, key, true);

    if (options.expectedVersion !== undefined) {
      return withObjectLock(target, async () => {
        const currentTarget = await resolveSafeObjectPath(this.rootDirectory, key, true);
        const currentVersion = await readFileVersion(currentTarget);
        if (currentVersion !== options.expectedVersion) {
          throw new PhotoStoreConflictError(key);
        }
        await writeAtomic(this.rootDirectory, currentTarget, body);
        return objectVersion(body);
      });
    }

    await writeAtomic(this.rootDirectory, target, body);
    return objectVersion(body);
  }

  async delete(key: string): Promise<void> {
    const target = await resolveSafeObjectPath(this.rootDirectory, key, false).catch((error) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    });
    if (target) {
      await fs.rm(target, { force: true });
    }
  }
}

async function writeAtomic(
  rootDirectory: string,
  target: string,
  body: PhotoObjectBody,
): Promise<void> {
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporary, body);
    await assertSafeDirectory(rootDirectory, path.dirname(target), false);
    await assertNotSymbolicLink(target);
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function resolveSafeObjectPath(
  rootDirectory: string,
  key: string,
  createParents: boolean,
): Promise<string> {
  const target = resolveObjectPath(rootDirectory, key);
  await assertSafeDirectory(rootDirectory, path.dirname(target), createParents);
  await assertNotSymbolicLink(target);
  return target;
}

async function assertSafeDirectory(
  rootDirectory: string,
  directory: string,
  create: boolean,
): Promise<void> {
  const root = path.resolve(rootDirectory);
  await assertRootDirectory(root, create);

  const relative = path.relative(root, directory);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    await assertDirectory(current, create);
  }

  const [realRoot, realDirectory] = await Promise.all([fs.realpath(root), fs.realpath(directory)]);
  const realRelative = path.relative(realRoot, realDirectory);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error(`对象目录通过符号链接超出根目录: ${directory}`);
  }
}

async function assertRootDirectory(root: string, create: boolean): Promise<void> {
  if (create) {
    await fs.mkdir(root, { recursive: true });
  }
  await assertDirectory(root, false);
}

async function assertDirectory(directory: string, create: boolean): Promise<void> {
  if (create) {
    await fs.mkdir(directory).catch((error) => {
      if (!isNodeError(error) || error.code !== "EEXIST") {
        throw error;
      }
    });
  }
  const stats = await fs.lstat(directory);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`对象目录不能是符号链接或非目录条目: ${directory}`);
  }
}

async function assertNotSymbolicLink(target: string): Promise<void> {
  const stats = await fs.lstat(target).catch((error) => {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  });
  if (stats?.isSymbolicLink()) {
    throw new Error(`对象不能是符号链接: ${target}`);
  }
}

async function readFileVersion(target: string): Promise<string | null> {
  try {
    return objectVersion(await fs.readFile(target));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function withObjectLock<T>(target: string, operation: () => Promise<T>): Promise<T> {
  const lock = `${target}.lock`;
  const retryDelayMs = 20;
  const maximumAttempts = 250;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const handle = await fs.open(lock, "wx").catch((error: unknown) => {
      if (isNodeError(error) && error.code === "EEXIST") {
        return null;
      }
      throw error;
    });
    if (!handle) {
      // 锁龄不能证明持有者已退出，慢写入或进程暂停时仍必须保持互斥。
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }
    try {
      return await operation();
    } finally {
      await handle.close();
      await fs.rm(lock, { force: true });
    }
  }

  throw new Error(
    `等待对象锁超时: ${lock}；请等待当前写入完成。若锁为异常退出遗留，确认所有写入进程已退出后再删除此锁文件重试`,
  );
}

function objectVersion(body: PhotoObjectBody): string {
  return createHash("sha256").update(body).digest("hex");
}

export class R2PhotoObjectStore implements PhotoObjectStore {
  readonly bucket: string;
  readonly client: R2PhotoClient;
  private readonly controlBucket: string;

  constructor(options: R2PhotoStoreOptions, client?: R2PhotoClient) {
    if (!options.controlBucket || options.controlBucket === options.bucket) {
      throw new Error("R2_PHOTO_CONTROL_BUCKET 必须指定与公开照片 bucket 不同的私有 bucket");
    }
    this.bucket = options.bucket;
    this.controlBucket = options.controlBucket;
    this.client =
      client ??
      new S3Client({
        endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
        region: "auto",
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
      });
  }

  async getText(key: string): Promise<PhotoTextObject | null> {
    return this.readText(this.bucketForKey(key), key);
  }

  private async readText(bucket: string, key: string): Promise<PhotoTextObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      if (!response.Body) {
        throw new Error(`R2 对象 ${key} 没有响应内容`);
      }
      if (!response.ETag) {
        throw new Error(`R2 对象 ${key} 没有 ETag`);
      }
      return {
        text: await response.Body.transformToString("utf-8"),
        version: response.ETag,
      };
    } catch (error) {
      if (isMissingObject(error)) {
        return null;
      }
      throw error;
    }
  }

  async put(key: string, body: PhotoObjectBody, options: PutPhotoObjectOptions): Promise<string> {
    const input: PutObjectCommandInput = {
      Bucket: this.bucketForKey(key),
      Key: key,
      Body: body,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
      IfMatch: typeof options.expectedVersion === "string" ? options.expectedVersion : undefined,
      IfNoneMatch: options.expectedVersion === null ? "*" : undefined,
    };
    try {
      const response = await this.client.send(new PutObjectCommand(input));
      if (!response.ETag) {
        throw new Error(`R2 对象 ${key} 写入响应缺少 ETag`);
      }
      return response.ETag;
    } catch (error) {
      if (isConditionalWriteConflict(error)) {
        throw new PhotoStoreConflictError(key);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketForKey(key),
        Key: key,
      }),
    );
  }

  close(): void {
    this.client.destroy();
  }

  async migrateControl(): Promise<boolean> {
    const key = PHOTO_CATALOG_CONTROL_KEY;
    const source = await this.readText(this.bucket, key);
    if (!source) {
      return false;
    }
    parsePhotoCatalogControl(JSON.parse(source.text));
    const destination = await this.getText(key);
    if (destination && destination.text !== source.text) {
      throw new Error("私有与公开控制文档不一致；请停止所有发布器并核对数据，不会覆盖或删除");
    }
    if (!destination) {
      await this.put(key, source.text, {
        contentType: "application/json; charset=utf-8",
        cacheControl: "no-store",
        expectedVersion: null,
      });
    }
    const copied = await this.getText(key);
    const current = await this.readText(this.bucket, key);
    if (copied?.text !== source.text || current?.version !== source.version) {
      throw new Error("迁移期间控制文档发生变化；已保留公开副本，请停止所有发布器后核对数据");
    }
    // 迁移是停写操作；R2 未承诺支持 DeleteObject 的条件删除。
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return true;
  }

  private bucketForKey(key: string): string {
    return key === PHOTO_CATALOG_CONTROL_KEY ? this.controlBucket : this.bucket;
  }
}

export function createR2PhotoObjectStore(
  environment: R2Environment = process.env,
): R2PhotoObjectStore {
  const accountId = readEnvironmentVariable(environment, "R2_ACCOUNT_ID");
  const accessKeyId = readEnvironmentVariable(environment, "R2_ACCESS_KEY_ID");
  const secretAccessKey = readEnvironmentVariable(environment, "R2_SECRET_ACCESS_KEY");
  const bucket = readEnvironmentVariable(environment, "R2_PHOTO_BUCKET");
  const controlBucket = readEnvironmentVariable(environment, "R2_PHOTO_CONTROL_BUCKET");

  return new R2PhotoObjectStore({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    controlBucket,
  });
}

function readEnvironmentVariable(environment: R2Environment, key: R2EnvironmentKey): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${key}`);
  }
  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isMissingObject(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const status =
    "$metadata" in error
      ? (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
  return error.name === "NoSuchKey" || error.name === "NotFound" || status === 404;
}

function isConditionalWriteConflict(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const status =
    "$metadata" in error
      ? (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
  return status === 409 || status === 412;
}
