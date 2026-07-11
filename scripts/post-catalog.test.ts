import { describe, expect, it } from "vitest";
import { buildRedirects, buildSitemap } from "./generate-sitemap";
import { parsePublishedPost } from "./lib/post-catalog";

const publishedSource = `---
title: New post
date: 2026-07-11
summary: Summary
tags: [astro, testing]
cover: cover.png
coverAlt: Cover
---
Body`;

describe("post catalog", () => {
  it("normalizes published post metadata", () => {
    expect(parsePublishedPost("new-post", publishedSource)).toMatchObject({
      slug: "new-post",
      date: "2026-07-11",
      tags: ["astro", "testing"],
    });
  });

  it("excludes drafts", () => {
    expect(
      parsePublishedPost("draft", publishedSource.replace("---\nBody", "draft: true\n---\nBody")),
    ).toBeNull();
  });

  it("builds sitemap and legacy redirects from the same catalog", () => {
    const posts = [{ slug: "new-post", date: "2026-07-11" }];
    expect(buildSitemap(posts)).toContain("/posts/new-post/");
    expect(buildRedirects(posts)).toContain("/new-post /posts/new-post/ 301");
  });
});
