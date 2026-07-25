import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { removeSourcePng } from "./clean-dist-png";
import { filenameToVariableName } from "./generate-covers";
import { getRelativePath } from "./generate-post-images";
import { buildRedirects, buildSitemap } from "./generate-sitemap";
import { parsePublishedPost } from "./lib/post-catalog";

const publishedSource = `---
title: New post
date: 2026-07-11
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
  });

  it("excludes drafts", () => {
    expect(
      parsePublishedPost("draft", publishedSource.replace("---\nBody", "draft: true\n---\nBody")),
    ).toBeNull();
  });

  it("rejects missing or invalid required frontmatter", () => {
    expect(() =>
      parsePublishedPost("missing-date", publishedSource.replace("date: 2026-07-11\n", "")),
    ).toThrow("date");
    expect(() =>
      parsePublishedPost(
        "invalid-date",
        publishedSource.replace("date: 2026-07-11", "date: not-a-date"),
      ),
    ).toThrow("date");
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
    expect(buildSitemap(posts)).not.toContain("/tags/single/");
    expect(buildRedirects(posts)).toContain("/new-post /posts/new-post/ 301");
  });

  it("keeps generated asset names and URLs stable", () => {
    expect(filenameToVariableName("2026-review.png")).toBe("c2026Review");
    expect(getRelativePath(`${process.cwd()}/public/posts/images/demo/cover.png`)).toBe(
      "/posts/images/demo/cover.png",
    );
  });

  it("removes only source PNG files from article directories", () => {
    const dist = makeDist('<img src="/posts/images/post/source.webp">');

    const result = removeSourcePng(dist);

    expect(result).toEqual({ removed: 1, freedBytes: 3 });
    expect(fs.existsSync(path.join(dist, "posts/images/post/source.png"))).toBe(false);
    expect(fs.existsSync(path.join(dist, "posts/images/post/optimized.webp"))).toBe(true);
    fs.rmSync(dist, { recursive: true });
  });

  it("refuses to delete PNG files the built HTML still references", () => {
    const dist = makeDist('<img src="/posts/images/post/source.png">');

    expect(() => removeSourcePng(dist)).toThrow("/posts/images/post/source.png");
    expect(fs.existsSync(path.join(dist, "posts/images/post/source.png"))).toBe(true);
    fs.rmSync(dist, { recursive: true });
  });
});

function makeDist(indexHtml: string) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "blog-clean-"));
  const articleDirectory = path.join(dist, "posts", "images", "post");
  fs.mkdirSync(articleDirectory, { recursive: true });
  fs.writeFileSync(path.join(articleDirectory, "source.png"), "png");
  fs.writeFileSync(path.join(articleDirectory, "optimized.webp"), "webp");
  fs.writeFileSync(path.join(dist, "index.html"), indexHtml);
  return dist;
}
