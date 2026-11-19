import { describe, expect, it } from "vitest";
import { buildFeed, feedChannels, filterFeedPosts } from "@/lib/feed";
import type { PublishedPost } from "@/lib/published-post";

function post(index: number, tags: string[] = index === 0 ? ["AI & tools"] : []): PublishedPost {
  return {
    slug: `post-${index}`,
    title: `Post ${index}`,
    date: `2026-07-${String(30 - index).padStart(2, "0")}`,
    summary: index === 0 ? "A <summary> & more" : `Summary ${index}`,
    tags,
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

  it("partitions posts cleanly between AI engineering and life channels", () => {
    const posts = [
      post(0, ["AI编程", "Agent"]),
      post(1, ["旅行", "生活"]),
      post(2, ["工程实践", "代码审查"]),
      post(3, ["影视", "Apple TV"]),
      post(4, ["MCP", "CLI"]),
    ];

    const all = filterFeedPosts(posts, "all");
    const ai = filterFeedPosts(posts, "ai");
    const life = filterFeedPosts(posts, "life");

    expect(all.map((item) => item.slug)).toEqual([
      "post-0",
      "post-1",
      "post-2",
      "post-3",
      "post-4",
    ]);
    expect(ai.map((item) => item.slug)).toEqual(["post-0", "post-2", "post-4"]);
    expect(life.map((item) => item.slug)).toEqual(["post-1", "post-3"]);
  });

  it("builds channel-specific feeds with dedicated self links and filtered items", () => {
    const posts = [post(0, ["Agent", "工程实践"]), post(1, ["旅行", "清迈", "生活"])];

    const aiFeed = buildFeed(posts, "ai");
    expect(aiFeed).toContain('<atom:link href="https://xingkaixin.me/feed-ai.xml"');
    expect(aiFeed).toContain("/posts/post-0/");
    expect(aiFeed).not.toContain("/posts/post-1/");

    const lifeFeed = buildFeed(posts, "life");
    expect(lifeFeed).toContain('<atom:link href="https://xingkaixin.me/feed-life.xml"');
    expect(lifeFeed).toContain("/posts/post-1/");
    expect(lifeFeed).not.toContain("/posts/post-0/");

    expect(feedChannels.map((channel) => channel.path)).toEqual([
      "/feed.xml",
      "/feed-ai.xml",
      "/feed-life.xml",
    ]);
  });
});
