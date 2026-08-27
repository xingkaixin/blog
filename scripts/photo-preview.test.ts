import fs from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer, build, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { assertPhotoDirectoryOutsidePublic, photoPreviewPlugin } from "./lib/photo-preview";

const directories: string[] = [];
const servers: ViteDevServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true })),
  );
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "photo-preview-test-"));
  directories.push(root);
  const directory = path.join(root, ".photo-preview");
  await fs.mkdir(path.join(directory, "catalog"), { recursive: true });
  await fs.writeFile(path.join(directory, "catalog/index.json"), '{"preview":true}');
  await fs.writeFile(path.join(directory, "catalog/control.json"), '{"private":true}');
  return { root, directory };
}

describe("photo preview isolation", () => {
  it("rejects public destinations while allowing sibling directories", () => {
    const publicDirectory = path.resolve("public");
    for (const directory of [publicDirectory, path.join(publicDirectory, "preview")]) {
      expect(() => assertPhotoDirectoryOutsidePublic(directory, publicDirectory)).toThrow(
        "公开目录",
      );
    }
    expect(() =>
      assertPhotoDirectoryOutsidePublic(path.resolve(".photo-preview"), publicDirectory),
    ).not.toThrow();
    expect(() =>
      assertPhotoDirectoryOutsidePublic(path.resolve("public-backup"), publicDirectory),
    ).not.toThrow();
  });

  it("serves display artifacts but hides private state and filesystem shortcuts", async () => {
    const { root, directory } = await fixture();
    const mediaKey = `media/${"a".repeat(32)}/480.webp`;
    await fs.mkdir(path.dirname(path.join(directory, mediaKey)), { recursive: true });
    await fs.writeFile(path.join(directory, mediaKey), new Uint8Array([1, 2, 3]));
    await fs.writeFile(path.join(root, ".env"), "PRIVATE_VALUE=secret");
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [photoPreviewPlugin(".photo-preview")],
      server: { host: "127.0.0.1", port: 0 },
    });
    servers.push(server);
    await server.listen();
    const origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`;

    expect(await (await fetch(`${origin}/__photos/catalog/index.json`)).json()).toEqual({
      preview: true,
    });
    expect(
      new Uint8Array(await (await fetch(`${origin}/__photos/${mediaKey}`)).arrayBuffer()),
    ).toEqual(new Uint8Array([1, 2, 3]));
    for (const url of [
      "/__photos/catalog/control.json",
      "/__photos/.env",
      "/__photos/catalog/%2e%2e/control.json",
      `/.photo-preview/catalog/control.json`,
      `/@fs/${directory}/catalog/control.json`,
      "/.env",
    ]) {
      const response = await fetch(`${origin}${url}`);
      expect([403, 404], url).toContain(response.status);
    }
  });

  it("does not copy local preview data into production output", async () => {
    const { root } = await fixture();
    await fs.writeFile(path.join(root, "index.html"), "<!doctype html><title>Test</title>");
    await fs.mkdir(path.join(root, "public"));
    await fs.writeFile(path.join(root, "public/robots.txt"), "User-agent: *");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [photoPreviewPlugin(".photo-preview")],
      build: { minify: false },
    });
    expect((await fs.readdir(path.join(root, "dist"))).toSorted()).toEqual([
      "index.html",
      "robots.txt",
    ]);
  });

  it("blocks direct builds that still contain the legacy public preview", async () => {
    const { root } = await fixture();
    await fs.mkdir(path.join(root, "public/photo-preview"), { recursive: true });
    await expect(
      build({
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [photoPreviewPlugin()],
        build: { write: false },
      }),
    ).rejects.toThrow("公开目录");
  });
});
