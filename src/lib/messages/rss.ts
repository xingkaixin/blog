import type { FeedChannelId } from "@/lib/feed";
import type { Locale } from "@/lib/i18n";

type RssChannelCopy = {
  shortLabel: string;
  name: string;
  description: string;
};

const zh = {
  title: "RSS 订阅",
  description: (site: string) => `通过 RSS 订阅${site}，在你习惯的阅读器里接收新文章。`,
  intro: "在你习惯的阅读器里，收到我的新文章。",
  body: "拨动下方短波频道，可以订阅全站，也可以只听 AI 工程或生活随笔。",
  tunerLabel: "选择 RSS 订阅频道",
  unit: "MHz",
  onAir: "最近播送",
  postCount: (count: number) => `${count} 篇`,
  channels: {
    all: {
      shortLabel: "全站",
      name: "全站主频",
      description: "接收全部文章更新，包含 AI 编程、Agent 工程、独立工具与生活记录。",
    },
    ai: {
      shortLabel: "AI 工程",
      name: "AI 编程与 Agent 专频",
      description: "只收 Agent Harness、代码审查、Spec 与开发者工具相关的工程文章。",
    },
    life: {
      shortLabel: "摄影生活",
      name: "游记、影视与生活专频",
      description: "暂别代码与工程，只接收旅行随笔、观影笔记和年终回顾。",
    },
  } satisfies Record<FeedChannelId, RssChannelCopy>,
  address: "订阅地址",
  copy: "复制频道",
  copying: "复制中…",
  copied: "已复制",
  copiedStatus: "频道地址已复制，可以粘贴到阅读器了。",
  retryCopy: "重试复制",
  copyFailed: "未能自动复制。地址已选中，请手动复制。",
  instructions: "复制上面的地址，在 RSS 阅读器中选择「添加订阅」，粘贴即可。",
  rawFeed: "查看原始 RSS 文件",
};

export type RssMessages = typeof zh;

const en: RssMessages = {
  title: "RSS",
  description: (site) =>
    `Subscribe to ${site} via RSS and get new posts in the reader you already use.`,
  intro: "Get my new posts in the reader you already use.",
  body: "Tune the shortwave dial below to follow everything, or pick just AI engineering or life notes. Posts are written in Chinese.",
  tunerLabel: "Choose an RSS channel",
  unit: "MHz",
  onAir: "Latest on air",
  postCount: (count) => `${count} ${count === 1 ? "post" : "posts"}`,
  channels: {
    all: {
      shortLabel: "All",
      name: "Full stream",
      description:
        "Every new post across AI coding, agent engineering, developer tools, and life notes.",
    },
    ai: {
      shortLabel: "AI & Eng",
      name: "AI coding & Agent frequency",
      description: "Only posts on agent harnesses, code review, specs, and software engineering.",
    },
    life: {
      shortLabel: "Life & Travel",
      name: "Travel, film & life frequency",
      description:
        "Skip the engineering talk—receive travel diaries, film notes, and year reviews.",
    },
  },
  address: "Feed address",
  copy: "Copy channel",
  copying: "Copying…",
  copied: "Copied",
  copiedStatus: "Channel address copied. Paste it into your reader.",
  retryCopy: "Try again",
  copyFailed: "Couldn't copy automatically. The address is selected; copy it manually.",
  instructions:
    "Copy the address above, choose “Add feed” or “Subscribe” in your RSS reader, and paste it in.",
  rawFeed: "View the raw RSS file",
};

export const rssMessages: Record<Locale, RssMessages> = { zh, en };
