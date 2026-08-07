export type SiteRouteId = "home" | "projects" | "photos" | "about" | "feed";

type SiteRoute = {
  id: SiteRouteId;
  href: string;
  path: string;
  label: string;
  searchTitle: string;
  keywords: string;
  status: string;
  desktop: boolean;
  sitemap: { changefreq: string; priority: string } | null;
};

const routes: SiteRoute[] = [
  {
    id: "home",
    href: "/",
    path: "/",
    label: "文章",
    searchTitle: "文章日志",
    keywords: "首页 文章 日志 home posts",
    status: "HOME",
    desktop: false,
    sitemap: { changefreq: "weekly", priority: "1.0" },
  },
  {
    id: "projects",
    href: "/projects/",
    path: "/projects",
    label: "工具箱",
    searchTitle: "工具箱",
    keywords: "工具 项目 projects",
    status: "PROJECTS",
    desktop: true,
    sitemap: { changefreq: "monthly", priority: "0.7" },
  },
  {
    id: "photos",
    href: "/photos/",
    path: "/photos",
    label: "照片",
    searchTitle: "照片墙",
    keywords: "照片 摄影 相册 photos",
    status: "PHOTOS",
    desktop: true,
    sitemap: { changefreq: "weekly", priority: "0.8" },
  },
  {
    id: "about",
    href: "/about/",
    path: "/about",
    label: "关于",
    searchTitle: "关于",
    keywords: "关于 联系 about",
    status: "ABOUT",
    desktop: true,
    sitemap: { changefreq: "yearly", priority: "0.6" },
  },
  {
    id: "feed",
    href: "/feed.xml",
    path: "/feed.xml",
    label: "订阅 RSS",
    searchTitle: "订阅 RSS",
    keywords: "订阅 rss feed",
    status: "SYSTEM",
    desktop: true,
    sitemap: null,
  },
];

export function normalizeSitePath(pathname: string): string {
  return decodeURI(pathname.replace(/\/$/, "") || "/");
}

export function isSiteRouteActive(currentPath: string, routePath: string): boolean {
  return normalizeSitePath(currentPath) === routePath;
}

export function siteStatus(currentPath: string): string {
  const path = normalizeSitePath(currentPath);
  if (path.startsWith("/posts/")) {
    return "READING";
  }
  if (path.startsWith("/tags/")) {
    return "TAG ARCHIVE";
  }
  return routes.find((route) => route.path === path)?.status ?? "SYSTEM";
}

export function desktopNavigation() {
  return routes.filter((route) => route.desktop).map(({ href, path }) => ({ href, path }));
}

export function mobileNavigation() {
  return routes.map(({ id, href, path, label }) => ({ id, href, path, label }));
}

export function searchNavigation() {
  return routes.map(({ id, href, path, searchTitle, keywords }) => ({
    id: `route-${id}`,
    href,
    hint: path,
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
