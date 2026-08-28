import { describe, expect, it } from "vitest";
import { siteConfig } from "../src/lib/site";
import { buildRedirects, buildSitemap } from "./generate-sitemap";
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
  it("normalizes published post metadata", () => {
    expect(parsePublishedPost("new-post", publishedSource)).toMatchObject({
      slug: "new-post",
      date: "2026-07-11",
      tags: ["astro", "testing"],
    });
  });

  it("accepts TOML frontmatter with the same metadata contract", () => {
    const source = `+++
title = "New post"
date = "2026-07-11"
summary = "Summary"
tags = ["astro", "testing"]
cover = "agent-friendly-tool.png"
coverAlt = "Cover"
+++
Body`;
    expect(parsePublishedPost("new-post", source)).toEqual(
      parsePublishedPost("new-post", publishedSource),
    );
    expect(() =>
      parsePublishedPost("new-post", source.replace('date = "2026-07-11"', "date = 2026-07-11")),
    ).toThrow("date");
  });

  it("excludes drafts", () => {
    expect(
      parsePublishedPost("draft", publishedSource.replace("---\nBody", "draft: true\n---\nBody")),
    ).toBeNull();
  });

  it("rejects unsafe post slugs before reading frontmatter", () => {
    expect(() => parsePublishedPost("two words", publishedSource)).toThrow("post slug");
    expect(() => parsePublishedPost("c&c", publishedSource)).toThrow("post slug");
  });

  it("rejects missing or invalid required frontmatter", () => {
    expect(() =>
      parsePublishedPost("missing-date", publishedSource.replace("date: '2026-07-11'\n", "")),
    ).toThrow("date");
    expect(() =>
      parsePublishedPost(
        "invalid-date",
        publishedSource.replace("date: '2026-07-11'", "date: not-a-date"),
      ),
    ).toThrow("date");
    expect(() =>
      parsePublishedPost(
        "duplicate-title",
        publishedSource.replace("title: New post", "title: New post\ntitle: Duplicate"),
      ),
    ).toThrow("duplicated mapping key");
    expect(() => parsePublishedPost("missing-frontmatter", "Body only")).toThrow(
      "Invalid frontmatter",
    );
  });

  it("rejects a cover with no matching asset", () => {
    expect(() =>
      parsePublishedPost(
        "missing-cover",
        publishedSource.replace("cover: agent-friendly-tool.png", "cover: nope.png"),
      ),
    ).toThrow("Cover image not found");
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
