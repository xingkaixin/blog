export type SiteRouteId = "home" | "projects" | "photos" | "tags" | "about" | "feed";

type SiteRoute = {
  id: SiteRouteId;
  href: string;
  label: string;
  searchTitle: string;
  keywords: string;
  status: string;
  desktop: boolean;
  mobile: boolean;
  sitemap: { changefreq: string; priority: string } | null;
};

const routes: SiteRoute[] = [
  {
    id: "home",
    href: "/",
    label: "文章",
    searchTitle: "文章日志",
    keywords: "首页 文章 日志 home posts",
    status: "HOME",
    desktop: false,
    mobile: true,
    sitemap: { changefreq: "weekly", priority: "1.0" },
  },
  {
    id: "projects",
    href: "/projects/",
    label: "工具箱",
    searchTitle: "工具箱",
    keywords: "工具 项目 projects",
    status: "PROJECTS",
    desktop: true,
    mobile: true,
    sitemap: { changefreq: "monthly", priority: "0.7" },
  },
  {
    id: "photos",
    href: "/photos/",
    label: "照片",
    searchTitle: "照片墙",
    keywords: "照片 摄影 相册 photos",
    status: "PHOTOS",
    desktop: true,
    mobile: true,
    sitemap: { changefreq: "weekly", priority: "0.8" },
  },
  {
    id: "tags",
    href: "/tags/",
    label: "标签",
    searchTitle: "标签索引",
    keywords: "标签 主题 分类 tags taxonomy",
    status: "TAGS",
    desktop: false,
    mobile: false,
    sitemap: { changefreq: "weekly", priority: "0.6" },
  },
  {
    id: "about",
    href: "/about/",
    label: "关于",
    searchTitle: "关于",
    keywords: "关于 联系 about",
    status: "ABOUT",
    desktop: true,
    mobile: true,
    sitemap: { changefreq: "yearly", priority: "0.6" },
  },
  {
    id: "feed",
    href: "/feed.xml",
    label: "订阅 RSS",
    searchTitle: "订阅 RSS",
    keywords: "订阅 rss feed",
    status: "SYSTEM",
    desktop: true,
    mobile: true,
    sitemap: null,
  },
];

export function normalizeSitePath(pathname: string): string {
  return decodeURI(pathname.replace(/\/$/, "") || "/");
}

function routePath(href: string): string {
  return normalizeSitePath(href);
}

export function isSiteRouteActive(currentPath: string, routePath: string): boolean {
  return normalizeSitePath(currentPath) === routePath;
}

export function siteStatus(currentPath: string): string {
  const path = normalizeSitePath(currentPath);
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

export function desktopNavigation() {
  return routes
    .filter((route) => route.desktop)
    .map(({ href }) => ({ href, path: routePath(href) }));
}

export function mobileNavigation() {
  return routes
    .filter((route) => route.mobile)
    .map(({ id, href, label }) => ({
      id,
      href,
      path: routePath(href),
      label,
    }));
}

export function searchNavigation() {
  return routes.map(({ id, href, searchTitle, keywords }) => ({
    id: `route-${id}`,
    href,
    hint: routePath(href),
    title: searchTitle,
    keywords,
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
