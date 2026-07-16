#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import type { PublishedPost } from "../src/lib/post-schema";
import { siteConfig } from "../src/lib/site";
import { readPublishedPosts } from "./lib/post-catalog";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const DIST_DIR = path.join(ROOT, "dist");
const FEED_ITEM_LIMIT = 20;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rssDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toUTCString();
}

function buildItem(post: PublishedPost) {
  const url = `${siteConfig.url}/posts/${post.slug}/`;
  const categories = post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`);

  return [
    "    <item>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    `      <pubDate>${rssDate(post.date)}</pubDate>`,
    `      <description>${escapeXml(post.summary)}</description>`,
    ...categories,
    "    </item>",
  ].join("\n");
}

export function buildFeed(posts: PublishedPost[]) {
  const items = posts.slice(0, FEED_ITEM_LIMIT);
  const lastBuildDate = items[0] ? rssDate(items[0].date) : new Date(0).toUTCString();
  const feedUrl = `${siteConfig.url}/feed.xml`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(siteConfig.title)}</title>`,
    `    <link>${escapeXml(siteConfig.url)}</link>`,
    `    <description>${escapeXml(siteConfig.description)}</description>`,
    `    <language>${escapeXml(siteConfig.language)}</language>`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...items.map(buildItem),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error("dist/ not found. Run astro build first.");
  }

  const posts = readPublishedPosts(POSTS_DIR);
  fs.writeFileSync(path.join(DIST_DIR, "feed.xml"), buildFeed(posts), "utf8");
  console.log(`✅ 生成 feed.xml（最新 ${Math.min(posts.length, FEED_ITEM_LIMIT)} 篇文章）`);
}

if (import.meta.main) {
  main();
}
