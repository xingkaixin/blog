import { describe, expect, it } from "vitest";
import {
  buildFeed,
  feedChannels,
  filterFeedPosts,
  normalizeFeedHtml,
  renderFeedXml,
} from "@/lib/feed";
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

  it("filters each topic by its tags and keeps uncategorized posts in the full stream", () => {
    const posts = [
      post(0, ["AI编程", "Agent"]),
      post(1, ["旅行", "生活"]),
      post(2, ["工程实践", "代码审查"]),
      post(3, ["影视", "Apple TV"]),
      post(4, ["MCP", "CLI"]),
      post(5, ["策略组", "科学上网"]),
    ];

    const all = filterFeedPosts(posts, "all");
    const ai = filterFeedPosts(posts, "ai");
    const life = filterFeedPosts(posts, "life");

    expect(all).toEqual(posts);
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

  it("includes full HTML content with absolute URLs and escaped CDATA delimiters", async () => {
    const html = normalizeFeedHtml(
      '<p>Read <a href="/posts/demo/">this</a> and <img src="/avatar.webp" alt="avatar" /></p>',
    );
    expect(html).toContain('href="https://xingkaixin.me/posts/demo/"');
    expect(html).toContain('src="https://xingkaixin.me/avatar.webp"');

    const xml = await renderFeedXml([
      {
        post: post(0, ["Agent"]),
        body: "## 小节\n\n正文含 `]]>` 与 [站内链接](/posts/demo/)。",
      },
    ]);
    expect(xml).toContain('xmlns:content="http://purl.org/rss/1.0/modules/content/"');
    expect(xml).toContain("<content:encoded><![CDATA[");
    expect(xml).toContain("]]]]><![CDATA[>");
    expect(xml).toContain('href="https://xingkaixin.me/posts/demo/"');
  });
});
