import { describe, expect, it } from "vitest";
import { siteConfig } from "../src/lib/site";
import { buildSitemap } from "../src/lib/sitemap";
import { buildRedirects } from "./generate-redirects";
import { parsePublishedPost } from "./lib/post-catalog";

const publishedSource = `---
title: New post
date: '2026-07-11'
summary: Summary
tags: [astro, testing]
cover: agent-friendly-tool.png
coverAlt: Cover
---
Body`;

describe("post catalog", () => {
  it("rejects unquoted YAML dates before generating artifacts", () => {
    const source = publishedSource.replace("'2026-07-11'", "2026-07-11");
    expect(() => parsePublishedPost("unquoted-date", source)).toThrow("date");
  });

  it("excludes drafts", () => {
    expect(
      parsePublishedPost("draft", publishedSource.replace("---\nBody", "draft: true\n---\nBody")),
    ).toBeNull();
  });

  it("builds sitemap and legacy redirects from the same catalog", () => {
    const posts = [
      { slug: "new-post", date: "2026-07-11", tags: ["shared", "single"] },
      { slug: "older-post", date: "2026-07-10", tags: ["shared", "archive-only"] },
      { slug: "oldest-post", date: "2026-07-09", tags: ["archive-only"] },
    ];
    const sitemap = buildSitemap(posts);
    for (const pathname of ["/", "/tags/", "/tags/archive-only/", "/posts/new-post/", "/photos/"]) {
      expect(sitemapEntry(sitemap, pathname)).not.toContain("<lastmod>");
    }
    expect(sitemap).not.toContain("/tags/single/");
    expect(buildRedirects(posts)).toContain("/new-post /posts/new-post/ 301");
  });
});

function sitemapEntry(sitemap: string, pathname: string): string {
  const loc = `<loc>${siteConfig.url}${pathname}</loc>`;
  const entry = sitemap.match(/  <url>[\s\S]*?  <\/url>/g)?.find((item) => item.includes(loc));
  if (!entry) {
    throw new Error(`Sitemap entry not found: ${pathname}`);
  }
  return entry;
}
