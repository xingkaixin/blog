import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

export type PhotoObjectBody = string | Uint8Array;

export type PutPhotoObjectOptions = {
  contentType: string;
  cacheControl: string;
};

export interface PhotoObjectStore {
  getText(key: string): Promise<string | null>;
  put(key: string, body: PhotoObjectBody, options: PutPhotoObjectOptions): Promise<void>;
  close?(): void;
}

type R2PhotoStoreOptions = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

type R2Environment = {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_PHOTO_BUCKET?: string;
};

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

  async getText(key: string): Promise<string | null> {
    try {
      return await fs.readFile(resolveObjectPath(this.rootDirectory, key), "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async put(key: string, body: PhotoObjectBody): Promise<void> {
    const target = resolveObjectPath(this.rootDirectory, key);
    await fs.mkdir(path.dirname(target), { recursive: true });

    const temporary = path.join(
      path.dirname(target),
      `.${path.basename(target)}.${randomUUID()}.tmp`,
    );
    await fs.writeFile(temporary, body);
    await fs.rename(temporary, target);
  }
}

export class R2PhotoObjectStore implements PhotoObjectStore {
  readonly bucket: string;
  readonly client: S3Client;

  constructor(options: R2PhotoStoreOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
      region: "auto",
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async getText(key: string): Promise<string | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!response.Body) {
        throw new Error(`R2 对象 ${key} 没有响应内容`);
      }
      return await response.Body.transformToString("utf-8");
    } catch (error) {
      if (isMissingObject(error)) {
        return null;
      }
      throw error;
    }
  }

  async put(key: string, body: PhotoObjectBody, options: PutPhotoObjectOptions): Promise<void> {
    const input: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
    };
    await this.client.send(new PutObjectCommand(input));
  }

  close(): void {
    this.client.destroy();
  }
}

export function createR2PhotoObjectStore(
  environment: R2Environment = process.env,
): R2PhotoObjectStore {
  const accountId = readEnvironmentVariable(environment, "R2_ACCOUNT_ID");
  const accessKeyId = readEnvironmentVariable(environment, "R2_ACCESS_KEY_ID");
  const secretAccessKey = readEnvironmentVariable(environment, "R2_SECRET_ACCESS_KEY");
  const bucket = readEnvironmentVariable(environment, "R2_PHOTO_BUCKET");

  return new R2PhotoObjectStore({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
  });
}

function readEnvironmentVariable(environment: R2Environment, key: keyof R2Environment): string {
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
