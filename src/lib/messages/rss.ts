import type { Locale } from "@/lib/i18n";

const zh = {
  title: "RSS 订阅",
  description: (site: string) => `通过 RSS 订阅${site}，在你习惯的阅读器里接收新文章。`,
  intro: "在你习惯的阅读器里，收到我的新文章。",
  body: "关于 AI、编程，也关于生活。",
  address: "订阅地址",
  copy: "复制链接",
  copying: "复制中…",
  copied: "已复制",
  copiedStatus: "链接已复制，可以粘贴到阅读器了。",
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
  body: "About AI and programming, and about life. Posts are written in Chinese.",
  address: "Feed address",
  copy: "Copy link",
  copying: "Copying…",
  copied: "Copied",
  copiedStatus: "Link copied. Paste it into your reader.",
  retryCopy: "Try again",
  copyFailed: "Couldn't copy automatically. The address is selected; copy it manually.",
  instructions:
    "Copy the address above, choose “Add feed” or “Subscribe” in your RSS reader, and paste it in.",
  rawFeed: "View the raw RSS file",
};

export const rssMessages: Record<Locale, RssMessages> = { zh, en };
