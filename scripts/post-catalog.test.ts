import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanUnreferencedPng } from "./clean-dist-png";
import { filenameToVariableName } from "./generate-covers";
import { getRelativePath } from "./generate-post-images";
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

  it("keeps generated asset names and URLs stable", () => {
    expect(filenameToVariableName("2026-review.png")).toBe("c2026Review");
    expect(getRelativePath(`${process.cwd()}/public/posts/images/demo/cover.png`)).toBe(
      "/posts/images/demo/cover.png",
    );
  });

  it("removes only source PNG files from article directories", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-clean-"));
    const articleDirectory = path.join(root, "post");
    fs.mkdirSync(articleDirectory);
    fs.writeFileSync(path.join(articleDirectory, "source.png"), "png");
    fs.writeFileSync(path.join(articleDirectory, "optimized.webp"), "webp");

    const result = cleanUnreferencedPng(root);

    expect(result).toEqual({ removed: 1, freedBytes: 3 });
    expect(fs.existsSync(path.join(articleDirectory, "source.png"))).toBe(false);
    expect(fs.existsSync(path.join(articleDirectory, "optimized.webp"))).toBe(true);
    fs.rmSync(root, { recursive: true });
  });
});
