#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { projects } from "../src/lib/projects";
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
  type: "website" | "webpage" | "article";
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
    if (!paragraphBuffer.length) {
      return;
    }
    const text = stripInlineMarkdown(paragraphBuffer.join(" ").trim());
    if (text) {
      parts.push(`<p>${escapeHtml(text)}</p>`);
    }
    paragraphBuffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        flushParagraph();
      }
      continue;
    }
    if (inCodeBlock) {
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const staticLevel = level === 1 ? 2 : level;
      parts.push(
        `<h${staticLevel}>${escapeHtml(stripInlineMarkdown(headingMatch[2]))}</h${staticLevel}>`,
      );
      continue;
    }

    const listMatch = /^[-*+\d.]\s+(.+)$/.exec(line);
    if (listMatch) {
      paragraphBuffer.push(listMatch[1]);
      continue;
    }

    const blockquoteMatch = /^>\s?(.*)$/.exec(line);
    if (blockquoteMatch) {
      if (blockquoteMatch[1].trim()) {
        paragraphBuffer.push(blockquoteMatch[1]);
      }
      continue;
    }

    if (!line.trim() || /^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph();
      continue;
    }

    if (line.trim().startsWith("<")) {
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return parts.join("\n");
}

function buildHomeStaticBody(posts: Pick<PostEntry, "slug" | "title" | "summary" | "date">[]) {
  return [
    "<main>",
    `<h1>${escapeHtml(siteConfig.title)}</h1>`,
    `<p>${escapeHtml(siteConfig.description)}</p>`,
    "<section>",
    "<h2>最新文章</h2>",
    ...posts.map((post) =>
      [
        "<article>",
        `<h3><a href="/posts/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a></h3>`,
        `<time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time>`,
        `<p>${escapeHtml(post.summary)}</p>`,
        "</article>",
      ].join(""),
    ),
    "</section>",
    "</main>",
  ].join("");
}

function buildStaticBody(post: Pick<PostEntry, "title" | "date" | "summary" | "content">): string {
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

function buildProjectsStaticBody() {
  return [
    "<main>",
    "<h1>工具箱</h1>",
    "<p>Kevin 发布和维护的 AI、CLI、数据库与开发者工具。</p>",
    "<section>",
    ...projects.map((project) =>
      [
        "<article>",
        project.url
          ? `<h2><a href="${escapeHtml(project.url)}">${escapeHtml(project.name)}</a></h2>`
          : `<h2>${escapeHtml(project.name)}</h2>`,
        `<p>${escapeHtml(project.description)}</p>`,
        "</article>",
      ].join(""),
    ),
    "</section>",
    "</main>",
  ].join("");
}

function personSchema() {
  return {
    "@type": "Person",
    "@id": `${siteConfig.url}/#person`,
    name: siteConfig.author,
    url: siteConfig.url,
  };
}

function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    name: siteConfig.title,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: siteConfig.language,
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
  };
}

function buildJsonLd(meta: PageMeta): string {
  let graph: object[];

  if (meta.type === "website") {
    graph = [personSchema(), websiteSchema()];
  } else if (meta.type === "webpage") {
    graph = [
      personSchema(),
      websiteSchema(),
      {
        "@type": "WebPage",
        "@id": meta.url,
        url: meta.url,
        name: meta.title,
        description: meta.description,
        inLanguage: siteConfig.language,
        isPartOf: { "@id": `${siteConfig.url}/#website` },
        author: { "@id": `${siteConfig.url}/#person` },
      },
    ];
  } else {
    graph = [
      personSchema(),
      websiteSchema(),
      {
        "@type": "BlogPosting",
        "@id": `${meta.url}#article`,
        headline: meta.title,
        description: meta.description,
        inLanguage: siteConfig.language,
        datePublished: meta.publishedTime,
        dateModified: meta.publishedTime,
        author: { "@id": `${siteConfig.url}/#person` },
        publisher: { "@id": `${siteConfig.url}/#person` },
        image: {
          "@type": "ImageObject",
          url: meta.image,
          width: OG_WIDTH,
          height: OG_HEIGHT,
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": meta.url },
        isPartOf: { "@id": `${siteConfig.url}/#website` },
        keywords: meta.tags ?? [],
      },
    ];
  }

  const schema = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return `    <script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function metaTags(meta: PageMeta) {
  const title = meta.type === "website" ? meta.title : `${meta.title} | ${siteConfig.title}`;
  const ogType = meta.type === "article" ? "article" : "website";
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
    `    <meta property="og:type" content="${ogType}" />`,
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
  const nextHead = cleanHead.replace(/(\n\s*<meta name="viewport"[^>]*>)/, `$1\n${metaTags(meta)}`);

  let result = html.replace(headMatch[0], `<head>${nextHead}\n${jsonLd}\n  </head>`);

  if (staticBody) {
    result = result.replace(/<div id="root"><\/div>/, `<div id="root">${staticBody}</div>`);
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
  const posts = readPosts();

  writePage(INDEX_FILE, baseHtml, siteMeta, buildHomeStaticBody(posts));

  const projectsMeta: PageMeta = {
    title: "工具箱",
    description: "Kevin 发布和维护的 AI、CLI、数据库与开发者工具。",
    url: `${siteConfig.url}/projects`,
    image: `${siteConfig.url}/og/site.png`,
    type: "webpage",
  };

  writePage(
    path.join(DIST_DIR, "projects", "index.html"),
    baseHtml,
    projectsMeta,
    buildProjectsStaticBody(),
  );

  for (const post of posts) {
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
