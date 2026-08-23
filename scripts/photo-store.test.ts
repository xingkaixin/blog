import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FilePhotoObjectStore,
  PhotoStoreConflictError,
  R2PhotoObjectStore,
  type R2PhotoClient,
} from "./lib/photo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("file photo store", () => {
  it("reads, conditionally writes, and deletes objects inside its root", async () => {
    const root = temporaryDirectory();
    const store = new FilePhotoObjectStore(root);
    const options = { contentType: "text/plain", cacheControl: "no-cache" };

    const version = await store.put("catalog/index.json", "first", options);
    expect(await store.getText("catalog/index.json")).toEqual({ text: "first", version });
    await expect(
      store.put("catalog/index.json", "conflict", { ...options, expectedVersion: "wrong" }),
    ).rejects.toBeInstanceOf(PhotoStoreConflictError);
    await store.put("catalog/index.json", "second", { ...options, expectedVersion: version });
    expect((await store.getText("catalog/index.json"))?.text).toBe("second");

    await store.delete("catalog/index.json");
    expect(await store.getText("catalog/index.json")).toBeNull();
  });

  it("rejects intermediate and root symbolic links", async () => {
    const parent = temporaryDirectory();
    const root = path.join(parent, "root");
    const outside = path.join(parent, "outside");
    await fs.mkdir(root);
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(root, "media"));
    const store = new FilePhotoObjectStore(root);
    const options = { contentType: "image/webp", cacheControl: "immutable" };

    await expect(store.put("media/photo/480.webp", "data", options)).rejects.toThrow("符号链接");
    await expect(fs.access(path.join(outside, "photo", "480.webp"))).rejects.toThrow();

    const linkedRoot = path.join(parent, "linked-root");
    await fs.symlink(outside, linkedRoot);
    await expect(
      new FilePhotoObjectStore(linkedRoot).put("catalog/index.json", "data", options),
    ).rejects.toThrow("符号链接");
  });
});

describe("R2 photo store", () => {
  it("maps get, put, and delete operations to S3 commands", async () => {
    const { store, send, destroy } = r2Store();
    send
      .mockResolvedValueOnce({
        ETag: '"v1"',
        Body: { transformToString: async () => "catalog" },
      })
      .mockResolvedValueOnce({ ETag: '"v2"' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    expect(await store.getText("catalog/index.json")).toEqual({
      text: "catalog",
      version: '"v1"',
    });
    const read = send.mock.calls[0][0];
    expect(read).toBeInstanceOf(GetObjectCommand);
    expect((read as GetObjectCommand).input).toMatchObject({
      Bucket: "photos",
      Key: "catalog/index.json",
    });

    expect(
      await store.put("catalog/index.json", "next", {
        contentType: "application/json",
        cacheControl: "no-cache",
        expectedVersion: '"v1"',
      }),
    ).toBe('"v2"');
    expect((send.mock.calls[1][0] as PutObjectCommand).input).toMatchObject({
      IfMatch: '"v1"',
      IfNoneMatch: undefined,
    });

    await expect(
      store.put("catalog/new.json", "new", {
        contentType: "application/json",
        cacheControl: "no-cache",
        expectedVersion: null,
      }),
    ).rejects.toThrow("写入响应缺少 ETag");
    expect((send.mock.calls[2][0] as PutObjectCommand).input).toMatchObject({
      IfMatch: undefined,
      IfNoneMatch: "*",
    });

    await store.delete("catalog/old.json");
    expect(send.mock.calls[3][0]).toBeInstanceOf(DeleteObjectCommand);
    store.close();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("maps missing objects and conditional conflicts", async () => {
    const { store, send } = r2Store();
    send.mockRejectedValueOnce(httpError(404));
    expect(await store.getText("missing.json")).toBeNull();

    for (const status of [409, 412]) {
      send.mockRejectedValueOnce(httpError(status));
      await expect(
        store.put("catalog/index.json", "next", {
          contentType: "application/json",
          cacheControl: "no-cache",
          expectedVersion: '"v1"',
        }),
      ).rejects.toBeInstanceOf(PhotoStoreConflictError);
    }

    const upstream = new Error("upstream failed");
    send.mockRejectedValueOnce(upstream);
    await expect(store.getText("catalog/index.json")).rejects.toBe(upstream);
  });
});

function temporaryDirectory(): string {
  const directory = fsSync.mkdtempSync(path.join(os.tmpdir(), "photo-store-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function r2Store() {
  const send = vi.fn();
  const destroy = vi.fn();
  const client = { send, destroy } as unknown as R2PhotoClient;
  const store = new R2PhotoObjectStore(
    {
      accountId: "account",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket: "photos",
    },
    client,
  );
  return { store, send, destroy };
}

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), {
    $metadata: { httpStatusCode: status },
  });
}
