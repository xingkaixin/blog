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

type PostEntry = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  content: string;
  draft: boolean;
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

function readPosts(): PostEntry[] {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const source = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data, content } = matter(source);

      return {
        slug: file.replace(/\.md$/, ""),
        title: frontmatterString(data.title),
        date: frontmatterString(data.date),
        summary: frontmatterString(data.summary),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        content,
        draft: Boolean(data.draft),
      };
    })
    .filter((post) => !post.draft);
}

// 去掉 Markdown 内联语法，保留纯文本
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

// 把 Markdown 正文转成简化的语义 HTML，供爬虫读取
function markdownToStaticHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const parts: string[] = [];
  let inCodeBlock = false;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const text = stripInlineMarkdown(paragraphBuffer.join(" ").trim());
    if (text) parts.push(`<p>${escapeHtml(text)}</p>`);
    paragraphBuffer = [];
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) flushParagraph();
      continue;
    }
    if (inCodeBlock) continue;

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      parts.push(`<h${level}>${escapeHtml(stripInlineMarkdown(headingMatch[2]))}</h${level}>`);
      continue;
    }

    const listMatch = /^[-*+\d.]\s+(.+)$/.exec(line);
    if (listMatch) {
      paragraphBuffer.push(listMatch[1]);
      continue;
    }

    const blockquoteMatch = /^>\s?(.*)$/.exec(line);
    if (blockquoteMatch) {
      if (blockquoteMatch[1].trim()) paragraphBuffer.push(blockquoteMatch[1]);
      continue;
    }

    if (!line.trim() || /^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph();
      continue;
    }

    if (line.trim().startsWith("<")) continue;

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return parts.join("\n");
}

function buildStaticBody(
  post: Pick<PostEntry, "title" | "date" | "summary" | "content">,
): string {
  const bodyHtml = markdownToStaticHtml(post.content);
  return [
    "<main>",
    `<h1>${escapeHtml(post.title)}</h1>`,
    `<time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time>`,
    `<p>${escapeHtml(post.summary)}</p>`,
    "<article>",
    bodyHtml,
    "</article>",
    "</main>",
  ].join("");
}

function buildJsonLd(meta: PageMeta): string {
  let schema: object;

  if (meta.type === "website") {
    schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.title,
      url: siteConfig.url,
      description: siteConfig.description,
      author: { "@type": "Person", name: siteConfig.author },
    };
  } else {
    schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: meta.title,
      description: meta.description,
      datePublished: meta.publishedTime ?? "",
      author: { "@type": "Person", name: siteConfig.author },
      image: meta.image,
      mainEntityOfPage: { "@type": "WebPage", "@id": meta.url },
      keywords: (meta.tags ?? []).join(", "),
      publisher: { "@type": "Person", name: siteConfig.author },
    };
  }

  return `    <script type="application/ld+json">${JSON.stringify(schema)}</script>`;
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
    .replace(/\n\s*<link rel="canonical"[^>]*>/g, "")
    .replace(/\n\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
}

function applyMeta(html: string, meta: PageMeta, staticBody?: string) {
  const headMatch = /<head>([\s\S]*?)<\/head>/.exec(html);
  if (!headMatch) {
    throw new Error("Missing <head> in dist/index.html");
  }

  const cleanHead = removeExistingMeta(headMatch[1]);
  const jsonLd = buildJsonLd(meta);
  const nextHead = cleanHead.replace(
    /(\n\s*<meta name="viewport"[^>]*>)/,
    `$1\n${metaTags(meta)}`,
  );

  let result = html.replace(headMatch[0], `<head>${nextHead}\n${jsonLd}\n  </head>`);

  if (staticBody) {
    result = result.replace(
      /<div id="root"><\/div>/,
      `<div id="root">${staticBody}</div>`,
    );
  }

  return result;
}

function writePage(filePath: string, html: string, meta: PageMeta, staticBody?: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, applyMeta(html, meta, staticBody), "utf8");
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
    const meta: PageMeta = {
      title: post.title,
      description: post.summary,
      url: `${siteConfig.url}/posts/${post.slug}`,
      image: `${siteConfig.url}/og/${post.slug}.png`,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
    };
    writePage(
      path.join(DIST_DIR, "posts", post.slug, "index.html"),
      baseHtml,
      meta,
      buildStaticBody(post),
    );
  }

  console.log("✅ 成功写入站点与文章页静态 OG meta、JSON-LD、静态正文");
}

main();
