#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { tagHref } from "../src/lib/post-tags";
import { parsePostSlug, postHref } from "../src/lib/published-post";
import { readPublishedPosts } from "./lib/post-catalog";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "content", "posts");
const DIST_DIR = path.join(ROOT, "dist");

// 旧 Hexo 站点的文章地址为 /<slug>，迁移后变为 /posts/<slug>/。
// 为每篇现存文章生成 301，把旧链接的权重转移到新地址；
// 未迁移内容（旧 tag/分页/已删文章）不软重定向到首页，由静态资源的 404.html 返回 404。
export function buildRedirects(posts: Array<{ slug: string }>) {
  const lines = [
    `${encodeURI("/tags/AI 编程")} ${tagHref("AI编程")} 301`,
    `${encodeURI("/tags/AI 编程/")} ${tagHref("AI编程")} 301`,
    ...posts.map(({ slug }) => {
      const encodedSlug = encodeURIComponent(parsePostSlug(slug));
      return `/${encodedSlug} ${postHref(slug)} 301`;
    }),
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error("dist/ not found. Run astro build first.");
  }

  const posts = readPublishedPosts(POSTS_DIR);
  fs.writeFileSync(path.join(DIST_DIR, "_redirects"), buildRedirects(posts), "utf8");
  console.log(`✅ 生成 _redirects（${posts.length} 篇文章）`);
}

if (import.meta.main) {
  main();
}
