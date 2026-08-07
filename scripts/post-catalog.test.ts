import { describe, expect, it } from "vitest";
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
  it("normalizes published post metadata", () => {
    expect(parsePublishedPost("new-post", publishedSource)).toMatchObject({
      slug: "new-post",
      date: "2026-07-11",
      tags: ["astro", "testing"],
    });
    expect(
      parsePublishedPost("unquoted-date", publishedSource.replace("'2026-07-11'", "2026-07-11")),
    ).toMatchObject({ date: "2026-07-11" });
  });

  it("excludes drafts", () => {
    expect(
      parsePublishedPost("draft", publishedSource.replace("---\nBody", "draft: true\n---\nBody")),
    ).toBeNull();
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
    ).toThrow("Map keys must be unique");
    expect(() => parsePublishedPost("missing-frontmatter", "Body only")).toThrow(
      "frontmatter delimiter",
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
      { slug: "older-post", date: "2026-07-10", tags: ["shared"] },
    ];
    expect(buildSitemap(posts)).toContain("/posts/new-post/");
    expect(buildSitemap(posts)).toContain("/tags/shared/");
    expect(buildSitemap(posts)).toContain("/photos/");
    expect(buildSitemap(posts)).not.toContain("/tags/single/");
    expect(buildRedirects(posts)).toContain("/new-post /posts/new-post/ 301");
  });
});
