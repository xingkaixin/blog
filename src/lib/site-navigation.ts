import { hasEnglishVersion, localizedHref, type Locale } from "./i18n";

export type SiteRouteId = "home" | "posts" | "projects" | "photos" | "tags" | "feed";

type SiteRoute = {
  id: SiteRouteId;
  href: string;
  label: string;
  searchTitle: string;
  en: { label: string; searchTitle: string };
  keywords: string;
  status: string;
  reload: boolean;
  desktop: boolean;
  mobile: boolean;
  sitemap: { changefreq: string; priority: string } | null;
};

const routes: SiteRoute[] = [
  {
    id: "home",
    href: "/",
    label: "首页",
    searchTitle: "首页",
    en: { label: "Home", searchTitle: "Home" },
    keywords: "首页 关于 联系 片尾 池塘 home about contact",
    status: "HOME",
    reload: false,
    desktop: false,
    mobile: true,
    sitemap: { changefreq: "weekly", priority: "1.0" },
  },
  {
    id: "posts",
    href: "/posts/",
    label: "文章",
    searchTitle: "文章日志",
    en: { label: "Posts (Chinese)", searchTitle: "Posts (Chinese)" },
    keywords: "文章 日志 归档 posts archive",
    status: "POSTS",
    reload: false,
    desktop: true,
    mobile: true,
    sitemap: { changefreq: "weekly", priority: "0.9" },
  },
  {
    id: "projects",
    href: "/projects/",
    label: "工具箱",
    searchTitle: "工具箱",
    en: { label: "Projects", searchTitle: "Projects" },
    keywords: "工具 项目 projects",
    status: "PROJECTS",
    reload: false,
    desktop: true,
    mobile: true,
    sitemap: { changefreq: "monthly", priority: "0.7" },
  },
  {
    id: "photos",
    href: "/photos/",
    label: "照片",
    searchTitle: "照片墙",
    en: { label: "Photos", searchTitle: "Photo Wall" },
    keywords: "照片 摄影 相册 photos",
    status: "PHOTOS",
    reload: false,
    desktop: true,
    mobile: true,
    sitemap: { changefreq: "weekly", priority: "0.8" },
  },
  {
    id: "tags",
    href: "/tags/",
    label: "标签",
    searchTitle: "标签索引",
    en: { label: "Tags (Chinese)", searchTitle: "Tag Index (Chinese)" },
    keywords: "标签 主题 分类 tags taxonomy",
    status: "TAGS",
    reload: false,
    desktop: false,
    mobile: false,
    sitemap: { changefreq: "weekly", priority: "0.6" },
  },
  {
    id: "feed",
    href: "/rss/",
    label: "订阅 RSS",
    searchTitle: "订阅 RSS",
    en: { label: "RSS", searchTitle: "Subscribe via RSS" },
    keywords: "订阅 rss feed",
    status: "RSS",
    reload: false,
    desktop: true,
    mobile: true,
    sitemap: { changefreq: "yearly", priority: "0.3" },
  },
];

export function normalizeSitePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function routePath(href: string): string {
  return normalizeSitePath(href);
}

export function isSiteRouteActive(currentPath: string, routePath: string): boolean {
  return normalizeSitePath(currentPath) === routePath;
}

export function siteStatus(currentPath: string): string {
  const path = normalizeSitePath(currentPath.replace(/^\/en(?=\/|$)/u, "") || "/");
  const routeStatus = routes.find((route) => routePath(route.href) === path)?.status;
  if (routeStatus) {
    return routeStatus;
  }
  if (path.startsWith("/posts/")) {
    return "READING";
  }
  if (path.startsWith("/tags/")) {
    return "TAG ARCHIVE";
  }
  return "SYSTEM";
}

export function desktopNavigation(locale: Locale = "zh") {
  return routes
    .filter((route) => route.desktop)
    .map(({ href, reload }) => ({
      href: localizedHref(href, locale),
      path: routePath(href),
      chineseOnly: locale === "en" && !hasEnglishVersion(href),
      reload,
    }));
}

export function mobileNavigation(locale: Locale = "zh") {
  return routes
    .filter((route) => route.mobile)
    .map(({ id, href, label, en, reload }) => ({
      id,
      href: localizedHref(href, locale),
      path: routePath(localizedHref(href, locale)),
      label: locale === "en" ? en.label : label,
      reload,
    }));
}

export function searchNavigation(locale: Locale = "zh") {
  return routes.map(({ id, href, searchTitle, en, keywords, reload }) => ({
    id: `route-${id}`,
    href: localizedHref(href, locale),
    hint: routePath(href),
    title: locale === "en" ? en.searchTitle : searchTitle,
    keywords,
    reload,
  }));
}

export function sitemapNavigation() {
  return routes.flatMap((route) =>
    route.sitemap
      ? [
          {
            href: route.href,
            changefreq: route.sitemap.changefreq,
            priority: route.sitemap.priority,
          },
        ]
      : [],
  );
}
