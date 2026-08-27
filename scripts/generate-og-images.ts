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
const FONT_DIR = path.join(ROOT, "scripts", "assets", "fonts");
const CACHE_FILE = path.join(ROOT, ".astro", "og-cache.json");
// 每张 OG 图要经 satori 渲染 1200x630 SVG 再由 sharp 编码 PNG。冷缓存下全量并发的
// 峰值内存随文章数线性增长，固定窗口把它压成常量。66 篇冷构建实测（10 核）：
// 无上限 5.6s/900MB，8 并发 5.7s/656MB，6 并发 6.1s/546MB，4 并发 8.7s/501MB。
const RENDER_CONCURRENCY = 8;
const WIDTH = 1200;
const HEIGHT = 630;
const CARD = { x: 48, y: 48, w: 1104, h: 534 };
const COVER = { x: 720, y: 100, w: 390, h: 430 };
const LOGO_SIZE = 32;
const LOGO_MARGIN = 24;

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
  paper: "#fafaf7",
  surface: "rgba(255,255,255,0.72)",
  accentSoft: "#f6e3de",
  ink: "#1b1c1f",
  inkMuted: "#46474d",
  inkSoft: "#5f6066",
  line: "rgba(27,28,31,0.044)",
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
    .resize(COVER.w, COVER.h, { fit: "cover" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function gridLayer(direction: "to right" | "to bottom") {
  return el("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      backgroundImage: `linear-gradient(${direction}, ${colors.line} 1px, transparent 1px)`,
      backgroundSize: "24px 24px",
    },
  });
}

function circle(cx: number, cy: number, r: number, opacity: number) {
  return el("div", {
    style: {
      position: "absolute",
      left: cx - r,
      top: cy - r,
      width: r * 2,
      height: r * 2,
      borderRadius: "50%",
      backgroundColor: colors.accentSoft,
      opacity,
    },
  });
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
    gridLayer("to right"),
    gridLayer("to bottom"),
    circle(160, 96, 260, 0.42),
    circle(1030, 78, 220, 0.28),
    el("div", {
      style: {
        position: "absolute",
        left: CARD.x,
        top: CARD.y,
        width: CARD.w,
        height: CARD.h,
        borderRadius: 38,
        backgroundColor: colors.surface,
        border: "1px solid rgba(255,255,255,0.78)",
        boxShadow: "0 24px 48px rgba(27,28,31,0.18)",
      },
    }),
    ...content,
  );
}

function logo(src: string) {
  return el("img", {
    src,
    style: {
      position: "absolute",
      left: CARD.x + CARD.w - LOGO_MARGIN - LOGO_SIZE,
      top: CARD.y + CARD.h - LOGO_MARGIN - LOGO_SIZE,
      width: LOGO_SIZE,
      height: LOGO_SIZE,
    },
  });
}

function postLayout(post: Post, coverSrc: string, logoSrc: string) {
  return background(
    el(
      "div",
      {
        style: {
          position: "absolute",
          left: 92,
          top: 86,
          width: 584,
          height: 486,
          display: "flex",
          flexDirection: "column",
        },
      },
      text(siteConfig.title, {
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 4,
        color: colors.inkSoft,
      }),
      text(post.title, {
        display: "block",
        marginTop: 30,
        fontSize: 52,
        lineHeight: "62px",
        fontWeight: 700,
        color: colors.ink,
        lineClamp: 3,
      }),
      text(post.summary, {
        display: "block",
        marginTop: 24,
        fontSize: 27,
        lineHeight: "40px",
        fontWeight: 400,
        color: colors.inkMuted,
        lineClamp: 2,
      }),
      el("div", { style: { display: "flex", flexGrow: 1 } }),
      text(formatCalendarDate(post.date), {
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: 2,
        color: colors.inkSoft,
      }),
      el(
        "div",
        { style: { display: "flex", gap: 28, marginTop: 16 } },
        ...post.tags
          .slice(0, 3)
          .map((tag) =>
            text(`# ${tag}`, { fontSize: 20, fontWeight: 700, color: colors.inkMuted }),
          ),
      ),
    ),
    el("img", {
      src: coverSrc,
      style: {
        position: "absolute",
        left: COVER.x,
        top: COVER.y,
        width: COVER.w,
        height: COVER.h,
        borderRadius: 34,
        objectFit: "cover",
      },
    }),
    logo(logoSrc),
  );
}

function siteLayout(logoSrc: string) {
  return background(
    el(
      "div",
      {
        style: {
          position: "absolute",
          left: 92,
          top: 110,
          width: 1000,
          display: "flex",
          flexDirection: "column",
        },
      },
      text("PERSONAL BLOG", {
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 5,
        color: colors.inkSoft,
      }),
      text(siteConfig.title, { marginTop: 44, fontSize: 80, fontWeight: 700, color: colors.ink }),
      text(siteConfig.description, {
        display: "block",
        marginTop: 24,
        fontSize: 30,
        lineHeight: "44px",
        fontWeight: 400,
        color: colors.inkMuted,
        lineClamp: 3,
      }),
    ),
    logo(logoSrc),
  );
}

async function renderToFile(layout: VNode, output: string) {
  const svg = await satori(layout as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: fonts(),
  });
  await sharp(Buffer.from(svg)).png().toFile(output);
}

async function renderPost(post: Post, output: string) {
  const [cover, logoSrc] = await Promise.all([coverDataUri(post.cover), logoDataUri()]);
  await renderToFile(postLayout(post, cover, logoSrc), output);
}

async function renderSite(output: string) {
  await renderToFile(siteLayout(await logoDataUri()), output);
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
    fs.readFileSync(LOGO_PATH),
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
