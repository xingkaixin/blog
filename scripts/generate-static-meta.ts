#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { siteConfig } from "../src/lib/site";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const DIST_DIR = path.join(ROOT, "dist");
const INDEX_FILE = path.join(DIST_DIR, "index.html");
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

type PageMeta = {
  title: string;
  description: string;
  url: string;
  image: string;
  type: "website" | "article";
  publishedTime?: string;
  tags?: string[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    .map((file) => {
      const source = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data } = matter(source);

      return {
        slug: file.replace(/\.md$/, ""),
        title: frontmatterString(data.title),
        date: frontmatterString(data.date),
        summary: frontmatterString(data.summary),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        draft: Boolean(data.draft),
      };
    })
    .filter((post) => !post.draft);
}

function metaTags(meta: PageMeta) {
  const title = meta.type === "website" ? meta.title : `${meta.title} | ${siteConfig.title}`;
  const articleTags =
    meta.type === "article"
      ? [
          meta.publishedTime
            ? `    <meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}" />`
            : "",
          ...(meta.tags ?? []).map(
            (tag) => `    <meta property="article:tag" content="${escapeHtml(tag)}" />`,
          ),
        ].filter(Boolean)
      : [];

  return [
    `    <title>${escapeHtml(title)}</title>`,
    `    <meta name="description" content="${escapeHtml(meta.description)}" />`,
    `    <link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    `    <meta name="theme-color" content="#f4efe6" />`,
    `    <meta property="og:type" content="${meta.type}" />`,
    `    <meta property="og:site_name" content="${escapeHtml(siteConfig.title)}" />`,
    `    <meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `    <meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `    <meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `    <meta property="og:image:width" content="${OG_WIDTH}" />`,
    `    <meta property="og:image:height" content="${OG_HEIGHT}" />`,
    `    <meta property="og:image:alt" content="${escapeHtml(meta.title)}" />`,
    ...articleTags,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    `    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />`,
  ].join("\n");
}

function removeExistingMeta(head: string) {
  return head
    .replace(/\n\s*<title>[\s\S]*?<\/title>/g, "")
    .replace(/\n\s*<meta name="description"[^>]*>/g, "")
    .replace(/\n\s*<meta name="theme-color"[^>]*>/g, "")
    .replace(/\n\s*<meta (?:property|name)="(?:og|twitter|article):[^"]+"[^>]*>/g, "")
    .replace(/\n\s*<meta property="og:[^"]+"[^>]*>/g, "")
    .replace(/\n\s*<link rel="canonical"[^>]*>/g, "");
}

function applyMeta(html: string, meta: PageMeta) {
  const headMatch = /<head>([\s\S]*?)<\/head>/.exec(html);
  if (!headMatch) {
    throw new Error("Missing <head> in dist/index.html");
  }

  const cleanHead = removeExistingMeta(headMatch[1]);
  const nextHead = cleanHead.replace(/(\n\s*<meta name="viewport"[^>]*>)/, `$1\n${metaTags(meta)}`);

  return html.replace(headMatch[0], `<head>${nextHead}</head>`);
}

function writePage(filePath: string, html: string, meta: PageMeta) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, applyMeta(html, meta), "utf8");
}

function main() {
  if (!fs.existsSync(INDEX_FILE)) {
    throw new Error("dist/index.html not found. Run vite build before generate-static-meta.");
  }

  const baseHtml = fs.readFileSync(INDEX_FILE, "utf8");
  const siteMeta: PageMeta = {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    image: `${siteConfig.url}/og/site.png`,
    type: "website",
  };

  writePage(INDEX_FILE, baseHtml, siteMeta);

  for (const post of readPosts()) {
    writePage(path.join(DIST_DIR, "posts", post.slug, "index.html"), baseHtml, {
      title: post.title,
      description: post.summary,
      url: `${siteConfig.url}/posts/${post.slug}`,
      image: `${siteConfig.url}/og/${post.slug}.png`,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
    });
  }

  console.log("✅ 成功写入站点与文章页静态 OG meta");
}

main();
