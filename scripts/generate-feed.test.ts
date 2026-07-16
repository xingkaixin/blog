import { describe, expect, it } from "vitest";
import type { PublishedPost } from "../src/lib/post-schema";
import { buildFeed } from "./generate-feed";

function post(index: number): PublishedPost {
  return {
    slug: `post-${index}`,
    title: `Post ${index}`,
    date: `2026-07-${String(30 - index).padStart(2, "0")}`,
    summary: index === 0 ? "A <summary> & more" : `Summary ${index}`,
    tags: index === 0 ? ["AI & tools"] : [],
    cover: "cover.png",
    coverAlt: "Cover",
  };
}

describe("RSS feed", () => {
  it("publishes the latest 20 summaries as valid RSS elements", () => {
    const feed = buildFeed(Array.from({ length: 21 }, (_, index) => post(index)));

    expect(feed).toContain('<rss version="2.0"');
    expect(feed).toContain('<atom:link href="https://xingkaixin.me/feed.xml"');
    expect(feed.match(/<item>/g)).toHaveLength(20);
    expect(feed).toContain("A &lt;summary&gt; &amp; more");
    expect(feed).toContain("AI &amp; tools");
    expect(feed).toContain("/posts/post-19/");
    expect(feed).not.toContain("/posts/post-20/");
  });
});
