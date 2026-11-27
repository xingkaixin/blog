import type { Locale } from "@/lib/i18n";

export const projectFilters = ["all", "ai", "ios", "cli", "extension", "database"] as const;

export type ProjectFilter = (typeof projectFilters)[number];

const zh = {
  title: "工具箱",
  description: "XingKaiXin 发布和维护的 iOS 应用、AI、CLI、数据库与开发者工具。",
  lead: "自己写、自己用的 AI 编程工具、本地桌面软件与 iOS 小应用，全部可免费体验。",
  maintained: (count: number) => `${count} 个在维护`,
  searchLabel: "搜索工具",
  searchPlaceholder: "搜索名称、类型或技术…",
  clearSearch: "清除搜索",
  filterLabel: "筛选工具",
  filters: {
    all: "全部",
    ai: "AI",
    ios: "iOS",
    cli: "CLI",
    extension: "扩展",
    database: "数据库",
  } satisfies Record<ProjectFilter, string>,
  empty: "没有匹配的工具",
  emptyHint: "换个关键词或选择其他分类。",
  showing: (visible: number, total: number) => `显示 ${visible} / ${total}`,
  visit: "访问产品",
  details: "详情",
  collapseDetails: "收起",
};

export type ProjectMessages = typeof zh;

const en: ProjectMessages = {
  title: "Projects",
  description:
    "iOS apps, AI tools, CLIs, database utilities and developer tools built and maintained by XingKaiXin.",
  lead: "AI coding tools, local desktop apps, and small iOS utilities I build and use myself—free to try.",
  maintained: (count) => `${count} maintained`,
  searchLabel: "Search tools",
  searchPlaceholder: "Search by name, type or tech…",
  clearSearch: "Clear search",
  filterLabel: "Filter tools",
  filters: {
    all: "All",
    ai: "AI",
    ios: "iOS",
    cli: "CLI",
    extension: "Extensions",
    database: "Databases",
  },
  empty: "No matching tools",
  emptyHint: "Try another keyword or pick a different category.",
  showing: (visible, total) => `Showing ${visible} / ${total}`,
  visit: "Visit",
  details: "Details",
  collapseDetails: "Hide",
};

export const projectMessages: Record<Locale, ProjectMessages> = { zh, en };
