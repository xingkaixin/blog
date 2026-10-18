import type { Locale } from "./i18n";

export const siteContacts = {
  email: {
    id: "email",
    label: "邮箱",
    value: "me@xingkaixin.me",
    href: "mailto:me@xingkaixin.me",
  },
  github: {
    id: "github",
    label: "GitHub",
    value: "github.com/xingkaixin",
    href: "https://github.com/xingkaixin",
  },
  x: {
    id: "x",
    label: "X",
    value: "@xingkaixin",
    href: "https://x.com/xingkaixin",
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    value: "@xingkaixin",
    href: "https://t.me/xingkaixin",
  },
} as const;

export type SiteContactId = keyof typeof siteContacts;
export type SiteContact = (typeof siteContacts)[SiteContactId];

type AboutIntroPart = string | { kind: "location" | "photography" | "devices"; text: string };

export const aboutIntro: readonly AboutIntroPart[] = [
  "Hey，我是 XingKaiXin，我在",
  { kind: "location", text: "上海" },
  "工作。工作、学习之余，我还是一个",
  { kind: "photography", text: "摄影爱好者" },
  "，同时也非常喜欢折腾各类",
  { kind: "devices", text: "数码产品" },
  "。",
];

const aboutIntroEn: readonly AboutIntroPart[] = [
  "Hey, I'm XingKaiXin. I work in ",
  { kind: "location", text: "Shanghai" },
  ". Outside of work and study, I'm a ",
  { kind: "photography", text: "photography enthusiast" },
  " who also loves tinkering with all kinds of ",
  { kind: "devices", text: "gadgets" },
  ".",
];

function plainText(parts: readonly AboutIntroPart[]) {
  return parts.map((part) => (typeof part === "string" ? part : part.text)).join("");
}

export const siteConfig = {
  title: "行开心的颠倒世界",
  description:
    "XingKaiXin 的个人博客，聚焦 AI 编程、Agent 工程与开发者工具，也写产品观察与生活体验。",
  url: "https://xingkaixin.me",
  photoUrl: "https://photos.xingkaixin.me",
  author: "XingKaiXin",
  language: "zh-CN",
  about: plainText(aboutIntro),
  motto:
    "人生不该只有一种体验，不应该每个人的生活都像钉子一样专注。做个兴趣广泛、体验丰富的人，同样幸福",
};

/** 随页面语言变化的站点文案；中文沿用 siteConfig。 */
export const siteCopy = {
  zh: {
    title: siteConfig.title,
    description: siteConfig.description,
    aboutIntro,
    about: siteConfig.about,
    motto: siteConfig.motto,
  },
  en: {
    title: "XingKaiXin's Upside Down",
    description:
      "XingKaiXin's blog on AI coding, agent engineering and developer tools, with notes on products and life along the way.",
    aboutIntro: aboutIntroEn,
    about: plainText(aboutIntroEn),
    motto:
      "Life shouldn't be just one kind of experience, and not everyone has to live with a nail's single-minded focus. Having wide interests and a life full of experiences is its own kind of happiness.",
  },
} satisfies Record<Locale, unknown>;
