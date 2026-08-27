import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTO_CATALOG_CONTROL_KEY } from "./lib/photo-catalog-control";
import {
  createR2PhotoObjectStore,
  FilePhotoObjectStore,
  PhotoStoreConflictError,
  R2PhotoObjectStore,
  type R2PhotoClient,
} from "./lib/photo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("file photo store", () => {
  it("writes concurrent photo variants into a new directory", async () => {
    const root = temporaryDirectory();
    const store = new FilePhotoObjectStore(root);
    const keys = [480, 960, 2048].map((width) => `media/photo/${width}.webp`);
    const results = await Promise.allSettled(
      keys.map((key) =>
        store.put(key, key, { contentType: "image/webp", cacheControl: "immutable" }),
      ),
    );

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(await Promise.all(keys.map((key) => fs.readFile(path.join(root, key), "utf8")))).toEqual(
      keys,
    );
  });

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

  it("keeps a slow writer exclusive after its lock becomes old", async () => {
    const root = temporaryDirectory();
    const store = new FilePhotoObjectStore(root);
    const key = "catalog/index.json";
    const options = { contentType: "application/json", cacheControl: "no-cache" };
    const version = await store.put(key, "initial", options);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const waiting = Promise.withResolvers<"waiting">();
    const writeFile = fs.writeFile;
    vi.spyOn(fs, "writeFile").mockImplementation(async (...args) => {
      if (args[1] === "first") {
        entered.resolve();
        await release.promise;
      }
      return writeFile(...args);
    });
    const open = fs.open;
    let collisions = 0;
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      try {
        return await open(...args);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "EEXIST" &&
          ++collisions === 2
        ) {
          waiting.resolve("waiting");
        }
        throw error;
      }
    });

    const first = store.put(key, "first", { ...options, expectedVersion: version });
    let second: Promise<PromiseSettledResult<string>[]> | undefined;
    try {
      await entered.promise;
      await fs.utimes(path.join(root, `${key}.lock`), new Date(0), new Date(0));
      second = Promise.allSettled([
        new FilePhotoObjectStore(root).put(key, "second", { ...options, expectedVersion: version }),
      ]);
      expect(await Promise.race([waiting.promise, second])).toBe("waiting");
      release.resolve();
      await first;
      expect(await second).toMatchObject([
        { status: "rejected", reason: expect.any(PhotoStoreConflictError) },
      ]);
      expect((await store.getText(key))?.text).toBe("first");
    } finally {
      release.resolve();
      await Promise.allSettled([first, second]);
    }
  });

  it("leaves an abandoned lock untouched and explains how to recover", async () => {
    const root = temporaryDirectory();
    const store = new FilePhotoObjectStore(root);
    const key = "catalog/index.json";
    const lock = path.join(root, `${key}.lock`);
    const options = { contentType: "application/json", cacheControl: "no-cache" };
    const version = await store.put(key, "initial", options);
    await fs.writeFile(lock, "existing owner");
    await fs.utimes(lock, new Date(0), new Date(0));

    await expect(store.put(key, "next", { ...options, expectedVersion: version })).rejects.toThrow(
      "确认所有写入进程已退出",
    );
    expect((await store.getText(key))?.text).toBe("initial");
    expect(await fs.readFile(lock, "utf8")).toBe("existing owner");
    await fs.rm(lock);
    await store.put(key, "next", { ...options, expectedVersion: version });
    expect((await store.getText(key))?.text).toBe("next");
  }, 10_000);

  it("releases its lock after an atomic write fails", async () => {
    const root = temporaryDirectory();
    const store = new FilePhotoObjectStore(root);
    const key = "catalog/index.json";
    const options = { contentType: "application/json", cacheControl: "no-cache" };
    const version = await store.put(key, "initial", options);
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk write failed"));

    await expect(
      store.put(key, "failed", { ...options, expectedVersion: version }),
    ).rejects.toThrow("disk write failed");
    expect((await store.getText(key))?.text).toBe("initial");
    await store.put(key, "next", { ...options, expectedVersion: version });
    expect((await store.getText(key))?.text).toBe("next");
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
  it("keeps control reads and writes out of the public bucket", async () => {
    const { store, send } = r2Store();
    send
      .mockResolvedValueOnce({ ETag: '"v1"', Body: { transformToString: async () => "control" } })
      .mockResolvedValueOnce({ ETag: '"v2"' });

    await store.getText(PHOTO_CATALOG_CONTROL_KEY);
    await store.put(PHOTO_CATALOG_CONTROL_KEY, "control", {
      contentType: "application/json",
      cacheControl: "no-store",
      expectedVersion: '"v1"',
    });
    const buckets = send.mock.calls.map(([command]) => command.input.Bucket);
    expect(buckets).toEqual(["photo-control", "photo-control"]);
  });

  it("requires a distinct private control bucket", () => {
    const environment = {
      R2_ACCOUNT_ID: "account",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PHOTO_BUCKET: "photos",
    };
    expect(() => createR2PhotoObjectStore(environment)).toThrow("R2_PHOTO_CONTROL_BUCKET");
    expect(() =>
      createR2PhotoObjectStore({ ...environment, R2_PHOTO_CONTROL_BUCKET: "photos" }),
    ).toThrow("不同");
  });

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
  const options = {
    accountId: "account",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucket: "photos",
    controlBucket: "photo-control",
  };
  const store = new R2PhotoObjectStore(options, client);
  return { store, send, destroy };
}

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), {
    $metadata: { httpStatusCode: status },
  });
}
