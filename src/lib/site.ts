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

export const siteConfig = {
  title: "行开心的颠倒世界",
  description:
    "XingKaiXin 的个人博客，聚焦 AI 编程、Agent 工程与开发者工具，也写产品观察与生活体验。",
  url: "https://xingkaixin.me",
  photoUrl: "https://photos.xingkaixin.me",
  author: "XingKaiXin",
  language: "zh-CN",
  about:
    "Hey，我是 XingKaiXin，我在上海工作。工作、学习之余，我还是一个摄影爱好者，同时也非常喜欢折腾各类数码产品。",
  motto:
    "人生不该只有一种体验，不应该每个人的生活都像钉子一样专注。做个兴趣广泛、体验丰富的人，同样幸福",
};
