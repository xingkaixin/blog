#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import type { PublishedPost } from "../src/lib/post-schema";
import { buildTagArchives, tagHref } from "../src/lib/post-tags";
import { siteConfig } from "../src/lib/site";
import { readPublishedPosts } from "./lib/post-catalog";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const DIST_DIR = path.join(ROOT, "dist");

export function buildSitemap(posts: Array<Pick<PublishedPost, "slug" | "date" | "tags">>) {
  const today = new Date().toISOString().slice(0, 10);

  const urlEntry = (loc: string, lastmod: string, changefreq: string, priority: string) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const entries = [
    urlEntry(`${siteConfig.url}/`, today, "weekly", "1.0"),
    urlEntry(`${siteConfig.url}/projects/`, today, "monthly", "0.7"),
    urlEntry(`${siteConfig.url}/about/`, today, "yearly", "0.6"),
    ...buildTagArchives(posts).map(({ tag }) =>
      urlEntry(`${siteConfig.url}${tagHref(tag)}`, today, "weekly", "0.6"),
    ),
    ...posts.map((p) => urlEntry(`${siteConfig.url}/posts/${p.slug}/`, p.date, "monthly", "0.8")),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

export function buildRobotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteConfig.url}/sitemap.xml\n`;
}

// 旧 Hexo 站点的文章地址为 /<slug>，迁移后变为 /posts/<slug>/。
// 为每篇现存文章生成 301，把旧链接的权重转移到新地址；
// 未迁移内容（旧 tag/分页/已删文章）不软重定向到首页，交由 catch-all 返回 404。
export function buildRedirects(posts: Array<{ slug: string }>) {
  const lines = [...posts.map((p) => `/${p.slug} /posts/${p.slug}/ 301`), "/* /404.html 404"];
  return `${lines.join("\n")}\n`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error("dist/ not found. Run astro build first.");
  }

  const posts = readPublishedPosts(POSTS_DIR);
  fs.writeFileSync(path.join(DIST_DIR, "sitemap.xml"), buildSitemap(posts), "utf8");
  fs.writeFileSync(path.join(DIST_DIR, "robots.txt"), buildRobotsTxt(), "utf8");
  fs.writeFileSync(path.join(DIST_DIR, "_redirects"), buildRedirects(posts), "utf8");
  console.log(`✅ 生成 sitemap.xml（${posts.length} 篇文章）、robots.txt 与 _redirects`);
}

if (import.meta.main) {
  main();
}
