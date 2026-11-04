import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTO_CATALOG_CONTROL_KEY } from "./photo-catalog-control";
import {
  createR2PhotoObjectStore,
  FilePhotoObjectStore,
  R2PhotoObjectStore,
  type R2PhotoClient,
} from "./photo-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("file photo store", () => {
  it("leaves an abandoned lock untouched and explains how to recover", async () => {
    const root = temporaryDirectory();
    const store = new FilePhotoObjectStore(root);
    const key = "catalog/index.json";
    const lock = path.join(root, `${key}.lock`);
    const options = {
      contentType: "application/json",
      cacheControl: "no-cache",
      expectedVersion: null,
    };
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
});

function temporaryDirectory(): string {
  const directory = fsSync.mkdtempSync(path.join(os.tmpdir(), "photo-store-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function r2Store() {
  const send = vi.fn();
  const client = { send, destroy: vi.fn() } as unknown as R2PhotoClient;
  const options = {
    accountId: "account",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucket: "photos",
    controlBucket: "photo-control",
  };
  const store = new R2PhotoObjectStore(options, client);
  return { store, send };
}
