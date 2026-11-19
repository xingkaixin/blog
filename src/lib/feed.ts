import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { resolveCover } from "@/lib/covers";
import { resolvePostImage } from "@/lib/post-images";
import { postHref, type PublishedPost } from "@/lib/published-post";
import { siteConfig } from "@/lib/site";
import { escapeXml } from "@/lib/xml-escaping";

export type FeedPost = PublishedPost & {
  contentHtml?: string;
};

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

function escapeCdata(value: string) {
  return value.replaceAll("]]>", "]]]]><![CDATA[>");
}

function toAbsoluteUrl(rawUrl: string): string {
  if (/^(?:https?:|mailto:|#)/i.test(rawUrl)) {
    return rawUrl;
  }
  const resolvedImage = resolvePostImage(rawUrl);
  const path = resolvedImage ? resolvedImage.desktop : rawUrl;
  try {
    return new URL(path, siteConfig.url).href;
  } catch {
    return rawUrl;
  }
}

export function normalizeFeedHtml(html: string, cover?: { filename: string; alt: string }): string {
  const rewritten = html.replace(
    /\b(src|href)="([^"]+)"/g,
    (_, attr: string, rawUrl: string) => `${attr}="${escapeXml(toAbsoluteUrl(rawUrl))}"`,
  );
  if (!cover) {
    return rewritten;
  }
  try {
    const resolved = resolveCover(cover.filename);
    const coverUrl = new URL(resolved.desktop, siteConfig.url).href;
    const figure = `<p><img src="${escapeXml(coverUrl)}" alt="${escapeXml(cover.alt)}" width="${resolved.width}" height="${resolved.height}" /></p>\n`;
    return `${figure}${rewritten}`;
  } catch {
    return rewritten;
  }
}

function buildItem(post: FeedPost) {
  const url = `${siteConfig.url}${postHref(post.slug)}`;
  const categories = post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`);
  const contentLines = post.contentHtml
    ? [`      <content:encoded><![CDATA[${escapeCdata(post.contentHtml)}]]></content:encoded>`]
    : [];

  return [
    "    <item>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    `      <pubDate>${rssDate(post.date)}</pubDate>`,
    `      <description>${escapeXml(post.summary)}</description>`,
    ...contentLines,
    ...categories,
    "    </item>",
  ].join("\n");
}

export function buildFeed(posts: FeedPost[], channelId: FeedChannelId = "all") {
  const channel = getFeedChannel(channelId);
  const items = filterFeedPosts(posts, channelId).slice(0, FEED_ITEM_LIMIT);
  const lastBuildDate = items[0] ? rssDate(items[0].date) : new Date(0).toUTCString();
  const feedUrl = `${siteConfig.url}${channel.path}`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
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

let markdownProcessorPromise: ReturnType<typeof createMarkdownProcessor> | null = null;

function getFeedMarkdownProcessor() {
  markdownProcessorPromise ??= createMarkdownProcessor({ syntaxHighlight: false });
  return markdownProcessorPromise;
}

export async function renderFeedXml(
  posts: Array<{ post: PublishedPost; body: string }>,
  channelId: FeedChannelId = "all",
): Promise<string> {
  const selected = filterFeedPosts(
    posts.map((entry) => ({ ...entry.post, body: entry.body })),
    channelId,
  ).slice(0, FEED_ITEM_LIMIT);
  const processor = await getFeedMarkdownProcessor();
  const rendered: FeedPost[] = await Promise.all(
    selected.map(async ({ body, ...post }) => {
      const { code } = await processor.render(body);
      return {
        ...post,
        contentHtml: normalizeFeedHtml(code, { filename: post.cover, alt: post.coverAlt }),
      };
    }),
  );
  return buildFeed(rendered, channelId);
}
