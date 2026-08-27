import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublishedPost } from "../src/lib/published-post";
import { checkGeneratedArtifacts } from "./check-generated-artifacts";
import { generateCovers, type GenerateCoversOptions } from "./generate-covers";
import { generateOgImages, type GenerateOgImagesOptions } from "./generate-og-images";
import { generatePostImages, type GeneratePostImagesOptions } from "./generate-post-images";

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe("image generators", () => {
  it("does not read queued responsive sources before converting the first image", async () => {
    const options = createPostImageOptions();
    fs.mkdirSync(options.sourceDirectory, { recursive: true });
    const sources = ["a.jpg", "b.jpg", "c.jpg"].map((name) =>
      path.join(options.sourceDirectory, name),
    );
    await Promise.all(sources.map((source) => writeFixture(source, "#ff0000", "jpeg")));
    const read = vi.spyOn(fs, "readFileSync");
    const generation = generatePostImages(options);
    try {
      const sourceReads = read.mock.calls
        .map(([file]) => file)
        .filter((file) => sources.includes(String(file)));
      expect(sourceReads).toEqual([sources[0]]);
    } finally {
      await generation;
    }
    expect(await generatePostImages(options)).toEqual({ generated: 0, reused: 3, removed: 0 });
  });

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
    expect(
      JSON.parse(fs.readFileSync(options.dataFile, "utf8"))["/posts/images/post/demo.jpg"],
    ).toMatchObject({ width: 24, height: 16 });

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

  it("generates cover data behind the stable cover module", async () => {
    const options = createCoverOptions();
    const source = path.join(options.sourceDirectory, "demo.png");
    fs.mkdirSync(options.sourceDirectory, { recursive: true });
    await writeFixture(source, "#00ff00", "png", { width: 801, height: 343 });

    expect(await generateCovers(options)).toEqual({ generated: 1, reused: 0, removed: 0 });
    expect(await generateCovers(options)).toEqual({ generated: 0, reused: 1, removed: 0 });
    expect(JSON.parse(fs.readFileSync(options.dataFile, "utf8"))["demo.png"]).toMatchObject({
      width: 801,
      height: 343,
    });
    expect(
      await new Bun.Image(path.join(options.outputDirectory, "demo-400.webp")).metadata(),
    ).toEqual({ width: 400, height: 171, format: "webp" });
    expect(fs.existsSync(path.join(options.outputDirectory, "demo-800.webp"))).toBe(true);
    expect(fs.existsSync(path.join(options.outputDirectory, "demo.webp"))).toBe(true);
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

  it("rejects responsive image sources that share an output stem", async () => {
    const options = createCoverOptions();
    fs.mkdirSync(options.sourceDirectory, { recursive: true });
    await Promise.all([
      writeFixture(path.join(options.sourceDirectory, "demo.png"), "#00ff00", "png"),
      writeFixture(path.join(options.sourceDirectory, "demo.jpg"), "#ff0000", "jpeg"),
    ]);

    await expect(generateCovers(options)).rejects.toThrow("多个封面源文件会生成同名输出: demo");
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

  it("reads OG sources only when a render slot is available", async () => {
    const root = createTemporaryDirectory();
    const release = Promise.withResolvers<void>();
    const reads: string[] = [];
    const posts = Array.from({ length: 12 }, (_, index): PublishedPost => ({
      slug: `post-${index}`,
      title: `Post ${index}`,
      date: "2026-08-27",
      summary: "Summary",
      tags: [],
      cover: "demo.png",
      coverAlt: "Demo cover",
    }));
    const generation = generateOgImages({
      outputDirectory: path.join(root, "output"),
      cacheFile: path.join(root, "cache.json"),
      posts,
      rendererFingerprint: "renderer-v1",
      concurrency: 2,
      coverSource: (post) => {
        reads.push(post.slug);
        return Buffer.from(post.slug);
      },
      renderPost: async (post, output) => {
        await release.promise;
        fs.writeFileSync(output, post.title);
      },
      renderSite: async (output) => {
        await release.promise;
        fs.writeFileSync(output, "site");
      },
    });
    try {
      expect(reads).toEqual([posts[0].slug]);
    } finally {
      release.resolve();
      await generation;
    }
    expect(reads).toEqual(posts.map((post) => post.slug));
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
