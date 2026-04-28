#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import sharp from "sharp";
import { siteConfig } from "../src/lib/site";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const COVER_DIR = path.join(ROOT, "src", "assets", "cover");
const OUTPUT_DIR = path.join(ROOT, "public", "og");
const WIDTH = 1200;
const HEIGHT = 630;

type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string;
  draft?: boolean;
};

const colors = {
  paper: "#f4efe6",
  surface: "#faf6ef",
  accentSoft: "#e4d9cb",
  ink: "#1f1812",
  inkMuted: "#654f36",
  inkSoft: "#8c7253",
  line: "rgba(101,79,54,0.16)",
};

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

function graphemes(value: string) {
  return Array.from(segmenter.segment(value), (part) => part.segment);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textUnits(value: string) {
  return graphemes(value).reduce((total, char) => {
    if (/\s/.test(char)) {
      return total + 0.35;
    }

    return total + (char.charCodeAt(0) > 255 ? 1 : 0.56);
  }, 0);
}

function wrapText(value: string, maxUnits: number, maxLines: number) {
  const lines: string[] = [];
  let current = "";

  for (const char of graphemes(value.replace(/\s+/g, " ").trim())) {
    const next = `${current}${char}`;

    if (current && textUnits(next) > maxUnits) {
      lines.push(current.trim());
      current = char.trimStart();
      continue;
    }

    current = next;
  }

  if (current) {
    lines.push(current.trim());
  }

  const limited = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    limited[maxLines - 1] = `${limited[maxLines - 1].replace(/[，。,.!?！？、\s]+$/u, "")}...`;
  }

  return limited;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function frontmatterString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function readPosts() {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file): Post => {
      const source = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data } = matter(source);

      return {
        slug: file.replace(/\.md$/, ""),
        title: frontmatterString(data.title),
        date: frontmatterString(data.date),
        summary: frontmatterString(data.summary),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        cover: frontmatterString(data.cover),
        draft: Boolean(data.draft),
      };
    })
    .filter((post) => !post.draft)
    .toSorted((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

function baseSvg() {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${colors.line}" stroke-width="1"/>
    </pattern>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#1f1812" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${colors.paper}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" opacity="0.55"/>
  <circle cx="160" cy="96" r="260" fill="${colors.accentSoft}" opacity="0.42"/>
  <circle cx="1030" cy="78" r="220" fill="${colors.accentSoft}" opacity="0.28"/>
  <rect x="48" y="48" width="1104" height="534" rx="38" fill="${colors.surface}" fill-opacity="0.72" stroke="rgba(255,255,255,0.78)" filter="url(#softShadow)"/>
</svg>`;
}

function textSvg(post: Post) {
  const title = wrapText(post.title, 10.8, 3);
  const summary = wrapText(post.summary, 17, 2);
  const tags = post.tags.slice(0, 3);

  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; }
  </style>
  <text x="92" y="116" fill="${colors.inkSoft}" font-size="24" font-weight="600" letter-spacing="4">${escapeXml(siteConfig.title)}</text>
  <text x="92" y="200" fill="${colors.ink}" font-size="52" font-weight="700">
    ${title.map((line, index) => `<tspan x="92" dy="${index === 0 ? 0 : 62}">${escapeXml(line)}</tspan>`).join("")}
  </text>
  <text x="92" y="${420 - Math.max(0, 3 - title.length) * 42}" fill="${colors.inkMuted}" font-size="27" font-weight="400">
    ${summary.map((line, index) => `<tspan x="92" dy="${index === 0 ? 0 : 40}">${escapeXml(line)}</tspan>`).join("")}
  </text>
  <text x="92" y="528" fill="${colors.inkSoft}" font-size="22" font-weight="600" letter-spacing="2">${escapeXml(formatDate(post.date))}</text>
  ${tags
    .map(
      (tag, index) => `
  <text x="${92 + index * 128}" y="568" fill="${colors.inkMuted}" font-size="20" font-weight="600"># ${escapeXml(tag)}</text>`,
    )
    .join("")}
</svg>`;
}

function siteTextSvg(posts: Post[]) {
  const latest = posts.slice(0, 3).map((post) => post.title);

  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; }
  </style>
  <text x="92" y="132" fill="${colors.inkSoft}" font-size="24" font-weight="600" letter-spacing="5">PERSONAL BLOG</text>
  <text x="92" y="245" fill="${colors.ink}" font-size="72" font-weight="750">${escapeXml(siteConfig.title)}</text>
  <text x="92" y="310" fill="${colors.inkMuted}" font-size="32" font-weight="400">${escapeXml(siteConfig.description)}</text>
  <text x="92" y="418" fill="${colors.inkSoft}" font-size="22" font-weight="650" letter-spacing="3">RECENT WRITING</text>
  ${latest
    .map(
      (title, index) => `
  <text x="92" y="${464 + index * 42}" fill="${colors.inkMuted}" font-size="24" font-weight="500">${escapeXml(wrapText(title, 24, 1)[0])}</text>`,
    )
    .join("")}
</svg>`;
}

async function coverBuffer(file: string, width: number, height: number) {
  const input = path.join(COVER_DIR, path.basename(file));
  const image = await sharp(input).resize(width, height, { fit: "cover" }).png().toBuffer();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="34" fill="#fff"/></svg>`,
  );

  return sharp(image)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function renderPost(post: Post) {
  const background = sharp(Buffer.from(baseSvg())).png();
  const cover = await coverBuffer(post.cover, 390, 430);

  await background
    .composite([
      { input: Buffer.from(textSvg(post)), top: 0, left: 0 },
      { input: cover, top: 100, left: 720 },
    ])
    .png()
    .toFile(path.join(OUTPUT_DIR, `${post.slug}.png`));
}

async function renderSite(posts: Post[]) {
  const latestCovers = await Promise.all(
    posts.slice(0, 3).map((post) => coverBuffer(post.cover, 220, 150)),
  );

  await sharp(Buffer.from(baseSvg()))
    .png()
    .composite([
      { input: Buffer.from(siteTextSvg(posts)), top: 0, left: 0 },
      ...latestCovers.map((cover, index) => ({
        input: cover,
        top: 150 + index * 132,
        left: 860 + index * 26,
      })),
    ])
    .png()
    .toFile(path.join(OUTPUT_DIR, "site.png"));
}

async function main() {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const posts = readPosts();
  await renderSite(posts);
  await Promise.all(posts.map(renderPost));

  console.log(`✅ 成功生成 ${posts.length + 1} 张 OG 图片: ${OUTPUT_DIR}`);
}

await main();
