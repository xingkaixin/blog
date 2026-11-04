import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { assertPhotoDirectoryOutsidePublic, photoPreviewPlugin } from "./photo-preview";

const directories: string[] = [];

afterEach(async () => {
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
