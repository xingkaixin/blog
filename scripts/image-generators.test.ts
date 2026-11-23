import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { checkGeneratedArtifacts } from "./check-generated-artifacts";
import { generateCovers, type GenerateCoversOptions } from "./generate-covers";
import { generatePostImages, type GeneratePostImagesOptions } from "./generate-post-images";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe("image generators", () => {
  it("generates post images from private sources and invalidates by content", async () => {
    const options = createPostImageOptions();
    const source = path.join(options.sourceDirectory, "post", "demo.jpg");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    await writeFixture(source, "#ff0000", "jpeg");

    expect(await generatePostImages(options)).toEqual({ generated: 1, reused: 0, removed: 0 });
    const mapping = JSON.parse(fs.readFileSync(options.dataFile, "utf8"))[
      "/posts/images/post/demo.jpg"
    ];
    expect(mapping).toMatchObject({
      webp: expect.stringMatching(/^\/posts\/images\/post\/demo\.[a-f0-9]{8}\.webp$/),
      mobile: expect.stringMatching(/^\/posts\/images\/post\/demo-800w\.[a-f0-9]{8}\.webp$/),
      desktop: expect.stringMatching(/^\/posts\/images\/post\/demo-1200w\.[a-f0-9]{8}\.webp$/),
      avif: expect.stringMatching(/^\/posts\/images\/post\/demo\.[a-f0-9]{8}\.avif$/),
      mobileAvif: expect.stringMatching(/^\/posts\/images\/post\/demo-800w\.[a-f0-9]{8}\.avif$/),
      desktopAvif: expect.stringMatching(/^\/posts\/images\/post\/demo-1200w\.[a-f0-9]{8}\.avif$/),
      width: 24,
      height: 16,
    });
    const full = path.join(options.outputDirectory, mapping.webp.replace(/^\/posts\/images\//, ""));
    const fullAvif = path.join(
      options.outputDirectory,
      mapping.avif.replace(/^\/posts\/images\//, ""),
    );
    expect((await sharp(full).metadata()).format).toBe("webp");
    expect((await sharp(fullAvif).metadata()).format).toBe("heif");
    expect(
      fs.existsSync(
        path.join(options.outputDirectory, mapping.mobile.replace(/^\/posts\/images\//, "")),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(options.outputDirectory, mapping.desktop.replace(/^\/posts\/images\//, "")),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(options.outputDirectory, mapping.mobileAvif.replace(/^\/posts\/images\//, "")),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(options.outputDirectory, mapping.desktopAvif.replace(/^\/posts\/images\//, "")),
      ),
    ).toBe(true);

    const orphanWebp = path.join(options.outputDirectory, "post", "orphan.webp");
    const orphanAvif = path.join(options.outputDirectory, "post", "orphan.avif");
    fs.writeFileSync(orphanWebp, "orphan");
    fs.writeFileSync(orphanAvif, "orphan");
    expect(await generatePostImages(options)).toEqual({ generated: 0, reused: 1, removed: 2 });
    expect(
      JSON.parse(fs.readFileSync(options.dataFile, "utf8"))["/posts/images/post/demo.jpg"],
    ).toEqual(mapping);

    await writeFixture(source, "#0000ff", "jpeg", { width: 16, height: 24 });
    fs.utimesSync(source, new Date(0), new Date(0));
    expect(await generatePostImages(options)).toEqual({ generated: 1, reused: 0, removed: 6 });
    const updatedMapping = JSON.parse(fs.readFileSync(options.dataFile, "utf8"))[
      "/posts/images/post/demo.jpg"
    ];
    expect(updatedMapping).toMatchObject({ width: 16, height: 24 });
    expect(updatedMapping.webp).not.toBe(mapping.webp);
    expect(updatedMapping.avif).not.toBe(mapping.avif);

    fs.writeFileSync(path.join(options.outputDirectory, "leaked.jpg"), "source");
    await expect(generatePostImages(options)).rejects.toThrow("非生成文件");
  });

  it("preserves published post images when the source set is empty", async () => {
    const options = createPostImageOptions();
    fs.mkdirSync(options.sourceDirectory, { recursive: true });
    fs.mkdirSync(options.outputDirectory, { recursive: true });
    const published = path.join(options.outputDirectory, "published.webp");
    fs.writeFileSync(published, "published");

    await expect(generatePostImages(options)).rejects.toThrow("源目录中没有图片");
    expect(fs.readFileSync(published, "utf8")).toBe("published");
    expect(fs.existsSync(options.dataFile)).toBe(false);
  });

  it("generates covers in a custom output directory named .cache", async () => {
    const options = createCoverOptions();
    options.outputDirectory = path.resolve(options.outputDirectory, "../../.cache");
    fs.mkdirSync(options.sourceDirectory, { recursive: true });
    await writeFixture(path.join(options.sourceDirectory, "demo.png"), "#00ff00", "png");
    expect(await generateCovers(options)).toEqual({ generated: 1, reused: 0, removed: 0 });
    const coverFiles = fs.readdirSync(options.outputDirectory).toSorted();
    expect(coverFiles).toHaveLength(6);
    expect(coverFiles[0]).toMatch(/^demo-400\.[a-f0-9]{8}\.avif$/);
    expect(coverFiles[1]).toMatch(/^demo-400\.[a-f0-9]{8}\.webp$/);
    expect(coverFiles[2]).toMatch(/^demo-800\.[a-f0-9]{8}\.avif$/);
    expect(coverFiles[3]).toMatch(/^demo-800\.[a-f0-9]{8}\.webp$/);
    expect(coverFiles[4]).toMatch(/^demo\.[a-f0-9]{8}\.avif$/);
    expect(coverFiles[5]).toMatch(/^demo\.[a-f0-9]{8}\.webp$/);
    expect(await generateCovers(options)).toEqual({ generated: 0, reused: 1, removed: 0 });
    expect(fs.readdirSync(options.outputDirectory).toSorted()).toEqual(coverFiles);
  });

  it("detects regenerated outputs missing from Git while ignoring unrelated files", async () => {
    const options = createCoverOptions();
    const root = path.resolve(options.outputDirectory, "../..");
    fs.mkdirSync(options.sourceDirectory, { recursive: true });
    await writeFixture(path.join(options.sourceDirectory, "demo.png"), "#00ff00", "png");
    await generateCovers(options);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
    git("init", "--quiet");
    git("add", "--", ".");
    expect(() => checkGeneratedArtifacts(root)).not.toThrow();

    const coverFile = fs
      .readdirSync(options.outputDirectory)
      .find((name) => name.startsWith("demo-400."))!;
    const output = path.join(options.outputDirectory, coverFile);
    git("rm", "--cached", "--", `public/cover/${coverFile}`);
    fs.rmSync(output);
    await generateCovers(options);
    expect(() => checkGeneratedArtifacts(root)).toThrow(coverFile);

    git("add", "--", `public/cover/${coverFile}`);
    fs.writeFileSync(path.join(root, "notes.txt"), "unrelated workspace file");
    expect(() => checkGeneratedArtifacts(root)).not.toThrow();
    fs.writeFileSync(output, "changed output");
    expect(() => checkGeneratedArtifacts(root)).toThrow(coverFile);
  });
});

function createPostImageOptions(): GeneratePostImagesOptions {
  const root = createTemporaryDirectory();
  return {
    sourceDirectory: path.join(root, "private", "post-images"),
    outputDirectory: path.join(root, "public", "posts", "images"),
    dataFile: path.join(root, "src", "lib", "generated", "post-images.json"),
    manifestFile: path.join(root, "cache", "post-images.json"),
  };
}

function createCoverOptions(): GenerateCoversOptions {
  const root = createTemporaryDirectory();
  return {
    sourceDirectory: path.join(root, "private", "covers"),
    outputDirectory: path.join(root, "public", "cover"),
    dataFile: path.join(root, "src", "lib", "generated", "covers.json"),
    manifestFile: path.join(root, "cache", "covers.json"),
  };
}

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "image-generator-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixture(
  file: string,
  background: string,
  format: "jpeg" | "png",
  dimensions = { width: 24, height: 16 },
) {
  const image = sharp({
    create: {
      ...dimensions,
      channels: 3,
      background,
    },
  });
  await (format === "jpeg" ? image.jpeg() : image.png()).toFile(file);
}
