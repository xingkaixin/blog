import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { generateCovers, type GenerateCoversOptions } from "./generate-covers";
import { generateOgImages, type GenerateOgImagesOptions } from "./generate-og-images";
import { generatePostImages, type GeneratePostImagesOptions } from "./generate-post-images";
import type { PublishedPost } from "./lib/post-catalog";

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
    expect(fs.readFileSync(options.dataFile, "utf8")).toContain('"/posts/images/post/demo.jpg"');

    const orphan = path.join(options.outputDirectory, "post", "orphan.webp");
    fs.writeFileSync(orphan, "orphan");
    expect(await generatePostImages(options)).toEqual({ generated: 0, reused: 1, removed: 1 });

    await writeFixture(source, "#0000ff", "jpeg");
    fs.utimesSync(source, new Date(0), new Date(0));
    expect(await generatePostImages(options)).toEqual({ generated: 1, reused: 0, removed: 0 });

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

  it("generates cover data behind the stable cover module", async () => {
    const options = createCoverOptions();
    const source = path.join(options.sourceDirectory, "demo.png");
    fs.mkdirSync(options.sourceDirectory, { recursive: true });
    await writeFixture(source, "#00ff00", "png");

    expect(await generateCovers(options)).toEqual({ generated: 1, reused: 0, removed: 0 });
    expect(await generateCovers(options)).toEqual({ generated: 0, reused: 1, removed: 0 });
    expect(JSON.parse(fs.readFileSync(options.dataFile, "utf8"))).toHaveProperty("demo.png");
    expect(fs.existsSync(path.join(options.outputDirectory, "demo-400.webp"))).toBe(true);
    expect(fs.existsSync(path.join(options.outputDirectory, "demo-800.webp"))).toBe(true);
    expect(fs.existsSync(path.join(options.outputDirectory, "demo.webp"))).toBe(true);
  });

  it("invalidates and cleans OG artifacts from content fingerprints", async () => {
    const root = createTemporaryDirectory();
    const outputDirectory = path.join(root, "public", "og");
    const cacheFile = path.join(root, "cache", "og.json");
    const post: PublishedPost = {
      slug: "demo",
      title: "Demo",
      date: "2026-08-07",
      summary: "Summary",
      tags: ["testing"],
      cover: "demo.png",
      coverAlt: "Demo cover",
    };
    const renders: string[] = [];
    let cover = Buffer.from("first-cover");
    const options: GenerateOgImagesOptions = {
      outputDirectory,
      cacheFile,
      posts: [post],
      rendererFingerprint: "renderer-v1",
      coverSource: () => cover,
      renderPost: async (current, output) => {
        renders.push(current.slug);
        fs.writeFileSync(output, current.title);
      },
      renderSite: async (output) => {
        renders.push("site");
        fs.writeFileSync(output, "site");
      },
    };

    expect(await generateOgImages(options)).toEqual({ rendered: 2, skipped: 0, removed: 0 });
    expect(await generateOgImages(options)).toEqual({ rendered: 0, skipped: 2, removed: 0 });

    cover = Buffer.from("changed-cover");
    fs.writeFileSync(path.join(outputDirectory, "orphan.png"), "orphan");
    expect(await generateOgImages(options)).toEqual({ rendered: 1, skipped: 1, removed: 1 });

    options.rendererFingerprint = "renderer-v2";
    expect(await generateOgImages(options)).toEqual({ rendered: 2, skipped: 0, removed: 0 });

    fs.rmSync(path.join(outputDirectory, "site.png"));
    expect(await generateOgImages(options)).toEqual({ rendered: 1, skipped: 1, removed: 0 });
    expect(renders).toEqual(["site", "demo", "demo", "site", "demo", "site"]);
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

async function writeFixture(file: string, background: string, format: "jpeg" | "png") {
  const image = sharp({
    create: {
      width: 24,
      height: 16,
      channels: 3,
      background,
    },
  });
  await (format === "jpeg" ? image.jpeg() : image.png()).toFile(file);
}
