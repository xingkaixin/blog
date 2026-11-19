import { postHref, type PublishedPost } from "@/lib/published-post";
import { siteConfig } from "@/lib/site";
import { escapeXml } from "@/lib/xml-escaping";

const FEED_ITEM_LIMIT = 20;

const AI_ENGINEERING_TAG_PATTERN =
  /(^ai|agent|llm|大模型|人工智能|mcp|claude|codex|cursor|openai|deepseek|vibe|prompt|karpathy|benchmark|swe-bench|蒸馏|推理引擎|模型评测|多智能体|skill|编程|代码|工程|架构|测试|ci|git|cli|rust|前端|可观测|cloudflare|运维|系统设计|软件|开发)/i;

const LIFE_TAGS = new Set(["生活", "旅行", "影视", "摄影", "年终回顾"]);

export type FeedChannelId = "all" | "ai" | "life";

export type FeedChannel = {
  id: FeedChannelId;
  frequency: string;
  dialPosition: number;
  path: string;
  title: string;
  description: string;
};

export const feedChannels: readonly FeedChannel[] = [
  {
    id: "all",
    frequency: "98.4",
    dialPosition: 16,
    path: "/feed.xml",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  {
    id: "ai",
    frequency: "102.6",
    dialPosition: 50,
    path: "/feed-ai.xml",
    title: `${siteConfig.title} · AI 编程与 Agent`,
    description: "聚焦 AI 编程、Agent 工程、代码审查、Spec 与开发者工具的技术文章。",
  },
  {
    id: "life",
    frequency: "106.2",
    dialPosition: 84,
    path: "/feed-life.xml",
    title: `${siteConfig.title} · 游记与生活`,
    description: "工作与代码之外的旅行记录、影视随笔、年终回顾与生活观察。",
  },
] as const;

export function isAiEngineeringPost(post: Pick<PublishedPost, "tags">): boolean {
  return post.tags.some((tag) => AI_ENGINEERING_TAG_PATTERN.test(tag));
}

export function filterFeedPosts<T extends Pick<PublishedPost, "tags">>(
  posts: T[],
  channelId: FeedChannelId,
): T[] {
  if (channelId === "all") {
    return posts;
  }
  if (channelId === "ai") {
    return posts.filter(isAiEngineeringPost);
  }
  return posts.filter((post) => post.tags.some((tag) => LIFE_TAGS.has(tag)));
}

export function getFeedChannel(channelId: FeedChannelId): FeedChannel {
  return feedChannels.find((channel) => channel.id === channelId) ?? feedChannels[0];
}

function rssDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toUTCString();
}

function buildItem(post: PublishedPost) {
  const url = `${siteConfig.url}${postHref(post.slug)}`;
  const categories = post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`);

  return [
    "    <item>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    `      <pubDate>${rssDate(post.date)}</pubDate>`,
    `      <description>${escapeXml(post.summary)}</description>`,
    ...categories,
    "    </item>",
  ].join("\n");
}

export function buildFeed(posts: PublishedPost[], channelId: FeedChannelId = "all") {
  const channel = getFeedChannel(channelId);
  const items = filterFeedPosts(posts, channelId).slice(0, FEED_ITEM_LIMIT);
  const lastBuildDate = items[0] ? rssDate(items[0].date) : new Date(0).toUTCString();
  const feedUrl = `${siteConfig.url}${channel.path}`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(siteConfig.url)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(siteConfig.language)}</language>`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...items.map(buildItem),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
