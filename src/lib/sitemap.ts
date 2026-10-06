import { buildPostTaxonomy } from "@/lib/post-tags";
import { postHref, type PublishedPost } from "@/lib/published-post";
import { siteConfig } from "@/lib/site";
import { sitemapNavigation } from "@/lib/site-navigation";
import { escapeXml } from "@/lib/xml-escaping";

export function buildSitemap(posts: Array<Pick<PublishedPost, "slug" | "tags">>) {
  const urlEntry = (loc: string, changefreq: string, priority: string) =>
    [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n");

  const entries = [
    ...sitemapNavigation().map((route) =>
      urlEntry(`${siteConfig.url}${route.href}`, route.changefreq, route.priority),
    ),
    ...buildPostTaxonomy(posts).archives.map(({ href }) =>
      urlEntry(`${siteConfig.url}${href}`, "weekly", "0.6"),
    ),
    ...posts.map((post) => urlEntry(`${siteConfig.url}${postHref(post.slug)}`, "monthly", "0.8")),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

export function buildRobotsTxt() {
  return `User-agent: *\nContent-Signal: ai-train=no, search=yes, ai-input=no\nAllow: /\n\nSitemap: ${siteConfig.url}/sitemap.xml\n`;
}
