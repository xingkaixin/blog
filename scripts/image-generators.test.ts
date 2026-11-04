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
    const full = path.join(options.outputDirectory, "post", "demo.webp");
    expect((await sharp(full).metadata()).format).toBe("webp");
    expect(fs.existsSync(path.join(options.outputDirectory, "post", "demo-800w.webp"))).toBe(true);
    expect(fs.existsSync(path.join(options.outputDirectory, "post", "demo-1200w.webp"))).toBe(true);
    const mapping = JSON.parse(fs.readFileSync(options.dataFile, "utf8"))[
      "/posts/images/post/demo.jpg"
    ];
    expect(mapping).toEqual({
      webp: "/posts/images/post/demo.webp",
      mobile: "/posts/images/post/demo-800w.webp",
      desktop: "/posts/images/post/demo-1200w.webp",
      width: 24,
      height: 16,
    });

    const orphan = path.join(options.outputDirectory, "post", "orphan.webp");
    fs.writeFileSync(orphan, "orphan");
    expect(await generatePostImages(options)).toEqual({ generated: 0, reused: 1, removed: 1 });
    expect(
      JSON.parse(fs.readFileSync(options.dataFile, "utf8"))["/posts/images/post/demo.jpg"],
    ).toMatchObject({ width: 24, height: 16 });

    await writeFixture(source, "#0000ff", "jpeg", { width: 16, height: 24 });
    fs.utimesSync(source, new Date(0), new Date(0));
    expect(await generatePostImages(options)).toEqual({ generated: 1, reused: 0, removed: 0 });
    expect(
      JSON.parse(fs.readFileSync(options.dataFile, "utf8"))["/posts/images/post/demo.jpg"],
    ).toMatchObject({ width: 16, height: 24 });

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

    const output = path.join(options.outputDirectory, "demo-400.webp");
    git("rm", "--cached", "--", "public/cover/demo-400.webp");
    fs.rmSync(output);
    await generateCovers(options);
    expect(() => checkGeneratedArtifacts(root)).toThrow("demo-400.webp");

    git("add", "--", "public/cover/demo-400.webp");
    fs.writeFileSync(path.join(root, "notes.txt"), "unrelated workspace file");
    expect(() => checkGeneratedArtifacts(root)).not.toThrow();
    fs.writeFileSync(output, "changed output");
    expect(() => checkGeneratedArtifacts(root)).toThrow("demo-400.webp");
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
