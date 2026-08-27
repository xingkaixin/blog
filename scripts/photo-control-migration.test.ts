import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { PHOTO_CATALOG_CONTROL_KEY } from "./lib/photo-catalog-control";
import { PhotoStoreConflictError, R2PhotoObjectStore } from "./lib/photo-store";

const publicKey = `photos/${PHOTO_CATALOG_CONTROL_KEY}`;
const privateKey = `photo-control/${PHOTO_CATALOG_CONTROL_KEY}`;
const control = JSON.stringify({
  schemaVersion: 3,
  generatedAt: "2026-08-27T00:00:00Z",
  albums: [],
  periods: [],
  photoMonths: {},
  retiredObjects: [],
  retiredArtifacts: [],
});

type Command = GetObjectCommand | PutObjectCommand | DeleteObjectCommand;

function migrationStore() {
  const objects = new Map([[publicKey, { text: control, version: "v1" }]]);
  const handle = async (command: Command) => {
    const key = `${command.input.Bucket}/${command.input.Key}`;
    const current = objects.get(key);
    if (command instanceof GetObjectCommand) {
      if (!current) {
        throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      }
      return { ETag: current.version, Body: { transformToString: async () => current.text } };
    }
    if (command instanceof PutObjectCommand) {
      if (typeof command.input.Body !== "string") {
        throw new Error("control body must be a string");
      }
      if (command.input.IfNoneMatch === "*" && current) {
        throw new PhotoStoreConflictError(key);
      }
      objects.set(key, { text: command.input.Body, version: "v2" });
      return { ETag: "v2" };
    }
    objects.delete(key);
    return {};
  };
  const send = vi.fn(handle);
  const store = new R2PhotoObjectStore(
    {
      accountId: "account",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket: "photos",
      controlBucket: "photo-control",
    },
    { send, destroy: vi.fn() },
  );
  return { store, objects, send, handle };
}

describe("private photo control migration", () => {
  it("preserves the verified private copy and removes only the public control document", async () => {
    const { store, objects } = migrationStore();
    objects.set("photos/media/example.webp", { text: "image", version: "image-v1" });
    await expect(store.migrateControl()).resolves.toBe(true);
    expect(objects.get(privateKey)?.text).toBe(control);
    expect(objects.has(publicKey)).toBe(false);
    expect(objects.has("photos/media/example.webp")).toBe(true);
    await expect(store.migrateControl()).resolves.toBe(false);
  });

  it("resumes after cleanup fails without replacing the private copy", async () => {
    const { store, objects, send, handle } = migrationStore();
    send.mockImplementation(async (command) => {
      if (command instanceof DeleteObjectCommand) {
        throw new Error("cleanup unavailable");
      }
      return handle(command);
    });
    await expect(store.migrateControl()).rejects.toThrow("cleanup unavailable");
    expect(objects.get(publicKey)?.text).toBe(control);
    expect(objects.get(privateKey)?.text).toBe(control);
    send.mockImplementation(handle);
    await expect(store.migrateControl()).resolves.toBe(true);
    expect(objects.has(publicKey)).toBe(false);
  });

  it("preserves both versions when the private copy differs", async () => {
    const { store, objects } = migrationStore();
    objects.set(privateKey, { text: "different control", version: "v2" });
    await expect(store.migrateControl()).rejects.toThrow("不一致");
    expect(objects.get(publicKey)?.text).toBe(control);
    expect(objects.get(privateKey)?.text).toBe("different control");
  });

  it("keeps the public copy if writing fails or a legacy writer changes it", async () => {
    for (const failure of ["write", "concurrent-update"]) {
      const { store, objects, send, handle } = migrationStore();
      send.mockImplementation(async (command) => {
        if (command instanceof PutObjectCommand) {
          if (failure === "write") {
            throw new Error("write failed");
          }
          objects.set(publicKey, { text: "new control", version: "v3" });
        }
        return handle(command);
      });
      await expect(store.migrateControl()).rejects.toThrow();
      expect(objects.has(publicKey)).toBe(true);
    }
  });
});
