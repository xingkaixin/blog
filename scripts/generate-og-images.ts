#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori, { type SatoriOptions } from "satori";
import sharp from "sharp";
import { formatCalendarDate } from "../src/lib/calendar-date";
import type { PublishedPost } from "../src/lib/published-post";
import { siteConfig } from "../src/lib/site";
import { fingerprint, reconcileArtifacts, type ArtifactPlan } from "./lib/artifact-reconciler";
import { readPublishedPosts } from "./lib/post-catalog";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const COVER_DIR = path.join(ROOT, "src", "assets", "cover");
const OUTPUT_DIR = path.join(ROOT, "public", "og");
const LOGO_PATH = path.join(ROOT, "public", "logo.svg");
const SITE_ART_PATH = path.join(ROOT, "src", "assets", "og", "living-room-v2.webp");
const FONT_DIR = path.join(ROOT, "scripts", "assets", "fonts");
const CACHE_FILE = path.join(ROOT, ".cache", "og-manifest.json");
// 每张 OG 图要经 satori 渲染 1200x630 SVG 再由 sharp 编码 PNG。冷缓存下全量并发的
// 峰值内存随文章数线性增长，固定窗口把它压成常量。66 篇冷构建实测（10 核）：
// 无上限 5.6s/900MB，8 并发 5.7s/656MB，6 并发 6.1s/546MB，4 并发 8.7s/501MB。
const RENDER_CONCURRENCY = 8;
const WIDTH = 1200;
const HEIGHT = 630;
const COVER = { x: 648, y: 152, w: 488, h: 326 };
const LOGO_SIZE = 34;

const FONT_FILES = [
  { file: "NotoSansSC-Regular.otf", weight: 400 },
  { file: "NotoSansSC-Bold.otf", weight: 700 },
] as const;

type Post = PublishedPost;

export type GenerateOgImagesOptions = {
  outputDirectory: string;
  cacheFile: string;
  posts: Post[];
  rendererFingerprint: string;
  coverSource: (post: Post) => Buffer;
  renderPost: (post: Post, output: string) => Promise<void>;
  renderSite: (output: string) => Promise<void>;
  concurrency?: number;
};

export type GenerateOgImagesResult = {
  rendered: number;
  skipped: number;
  removed: number;
};

const colors = {
  paper: "#f8f7f2",
  ink: "#232820",
  inkMuted: "#65685f",
  accent: "#b84532",
  line: "#dcded5",
};

type Child = VNode | string;

type VNode = {
  type: string;
  props: { style?: Record<string, unknown>; src?: string; children?: Child | Child[] };
};

function el(type: string, props: VNode["props"], ...children: Child[]): VNode {
  if (children.length === 0) {
    return { type, props };
  }
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

function text(content: string, style: Record<string, unknown>) {
  return el("div", { style }, content);
}

function postFingerprintParts(
  post: Post,
  rendererFingerprint: string,
  coverSource: Buffer,
): Array<string | Buffer> {
  const renderInput = {
    title: post.title,
    date: post.date,
    summary: post.summary,
    tags: post.tags,
    cover: post.cover,
    siteTitle: siteConfig.title,
  };
  return [rendererFingerprint, JSON.stringify(renderInput), coverSource];
}

function siteFingerprintParts(rendererFingerprint: string): string[] {
  const renderInput = {
    title: siteConfig.title,
    description: siteConfig.description,
  };
  return [rendererFingerprint, JSON.stringify(renderInput)];
}

let fontsCache: SatoriOptions["fonts"] | null = null;

function fonts() {
  fontsCache ??= FONT_FILES.map(({ file, weight }) => ({
    name: "Noto Sans SC",
    data: fs.readFileSync(path.join(FONT_DIR, file)),
    weight,
    style: "normal" as const,
  }));
  return fontsCache;
}

let logoDataUriPromise: Promise<string> | null = null;

function logoDataUri() {
  logoDataUriPromise ??= sharp(LOGO_PATH, { density: 384 })
    .resize(LOGO_SIZE, LOGO_SIZE)
    .png()
    .toBuffer()
    .then((buffer) => `data:image/png;base64,${buffer.toString("base64")}`);
  return logoDataUriPromise;
}

async function coverDataUri(file: string) {
  const buffer = await sharp(path.join(COVER_DIR, path.basename(file)))
    .resize(COVER.w, COVER.h, { fit: "contain", background: colors.paper })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function background(...content: Child[]) {
  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: colors.paper,
        fontFamily: "Noto Sans SC",
      },
    },
    ...content,
  );
}

function logo(src: string) {
  return el("img", {
    src,
    style: { width: LOGO_SIZE, height: LOGO_SIZE },
  });
}

function postLayout(post: Post, coverSrc: string, logoSrc: string) {
  return background(
    el(
      "div",
      {
        style: {
          position: "absolute",
          left: 64,
          top: 54,
          display: "flex",
          alignItems: "center",
          gap: 16,
        },
      },
      logo(logoSrc),
      text(siteConfig.title, { fontSize: 23, color: colors.inkMuted }),
    ),
    el(
      "div",
      {
        style: {
          position: "absolute",
          left: 64,
          top: 152,
          width: 536,
          height: 326,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        },
      },
      text(post.title, {
        fontSize: post.title.length > 52 ? 42 : 48,
        lineHeight: 1.35,
        fontWeight: 700,
        color: colors.ink,
      }),
    ),
    el("img", {
      src: coverSrc,
      style: {
        position: "absolute",
        left: COVER.x,
        top: COVER.y,
        width: COVER.w,
        height: COVER.h,
        objectFit: "contain",
      },
    }),
    el(
      "div",
      {
        style: {
          position: "absolute",
          left: 64,
          top: 536,
          width: 1072,
          paddingTop: 22,
          borderTop: `1px solid ${colors.line}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: colors.inkMuted,
          fontSize: 20,
        },
      },
      text(formatCalendarDate(post.date), {}),
      text(new URL(siteConfig.url).host, { color: colors.accent }),
    ),
  );
}

function siteLayout(artSrc: string) {
  return background(
    el("img", {
      src: artSrc,
      style: { position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT },
    }),
    el(
      "div",
      {
        style: {
          position: "absolute",
          left: 64,
          top: 72,
          width: 440,
          display: "flex",
          flexDirection: "column",
        },
      },
      text(siteConfig.author, {
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: 1,
        color: colors.accent,
      }),
      text(siteConfig.title, {
        width: 350,
        marginTop: 42,
        fontSize: 78,
        lineHeight: 1.18,
        fontWeight: 700,
        color: colors.ink,
      }),
      text("AI 编程 · Agent 工程", {
        marginTop: 32,
        fontSize: 25,
        color: colors.inkMuted,
      }),
      text("开发者工具 · 摄影与生活", {
        marginTop: 8,
        fontSize: 25,
        color: colors.inkMuted,
      }),
    ),
    text(new URL(siteConfig.url).host, {
      position: "absolute",
      left: 64,
      top: 554,
      fontSize: 22,
      color: colors.accent,
    }),
  );
}

async function renderToFile(layout: VNode, output: string) {
  const svg = await satori(layout as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: fonts(),
  });
  await sharp(Buffer.from(svg))
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toFile(output);
}

async function renderPost(post: Post, output: string) {
  const [cover, logoSrc] = await Promise.all([coverDataUri(post.cover), logoDataUri()]);
  await renderToFile(postLayout(post, cover, logoSrc), output);
}

async function renderSite(output: string) {
  const art = await sharp(SITE_ART_PATH).resize(WIDTH, HEIGHT).png().toBuffer();
  await renderToFile(siteLayout(`data:image/png;base64,${art.toString("base64")}`), output);
}

export async function generateOgImages(
  options: GenerateOgImagesOptions = defaultOptions(),
): Promise<GenerateOgImagesResult> {
  const siteOutput = path.join(options.outputDirectory, "site.png");
  const plans: ArtifactPlan[] = [
    {
      key: "site",
      fingerprint: () => fingerprint(siteFingerprintParts(options.rendererFingerprint)),
      outputs: [siteOutput],
      generate: () => options.renderSite(siteOutput),
    },
    ...options.posts.map((post): ArtifactPlan => {
      const output = path.join(options.outputDirectory, `${post.slug}.png`);
      return {
        key: `post:${post.slug}`,
        fingerprint: () =>
          fingerprint(
            postFingerprintParts(post, options.rendererFingerprint, options.coverSource(post)),
          ),
        outputs: [output],
        generate: () => options.renderPost(post, output),
      };
    }),
  ];
  const result = await reconcileArtifacts({
    outputDirectory: options.outputDirectory,
    manifestFile: options.cacheFile,
    artifactExtension: ".png",
    plans,
    concurrency: options.concurrency ?? RENDER_CONCURRENCY,
  });

  return { rendered: result.generated, skipped: result.reused, removed: result.removed };
}

function defaultOptions(): GenerateOgImagesOptions {
  const rendererFingerprint = fingerprint([
    fs.readFileSync(fileURLToPath(import.meta.url)),
    fs.readFileSync(fileURLToPath(new URL("../src/lib/calendar-date.ts", import.meta.url))),
    fs.readFileSync(fileURLToPath(import.meta.resolve("satori/package.json"))),
    fs.readFileSync(LOGO_PATH),
    fs.readFileSync(SITE_ART_PATH),
    siteConfig.url,
    siteConfig.author,
    ...FONT_FILES.map(({ file }) => fs.readFileSync(path.join(FONT_DIR, file))),
    JSON.stringify(sharp.versions),
  ]);
  return {
    outputDirectory: OUTPUT_DIR,
    cacheFile: CACHE_FILE,
    posts: readPublishedPosts(POSTS_DIR),
    rendererFingerprint,
    coverSource: (post) => fs.readFileSync(path.join(COVER_DIR, path.basename(post.cover))),
    renderPost,
    renderSite,
  };
}

if (import.meta.main) {
  const result = await generateOgImages();
  console.log(
    `✅ OG 图片：生成 ${result.rendered}，跳过 ${result.skipped}，清理 ${result.removed}: ${OUTPUT_DIR}`,
  );
}
