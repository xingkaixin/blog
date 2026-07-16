import { describe, expect, it } from "vitest";
import { buildJsonLd, ogType, pageImage, pageTitle, type PageMeta } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

const websiteMeta: PageMeta = {
  title: siteConfig.title,
  description: siteConfig.description,
  url: `${siteConfig.url}/`,
  type: "website",
};

const articleMeta: PageMeta = {
  title: "测试文章",
  description: "文章摘要",
  url: `${siteConfig.url}/posts/test/`,
  image: `${siteConfig.url}/og/test.png`,
  type: "article",
  publishedTime: "2026-07-16",
  tags: ["测试", "Astro"],
  breadcrumb: [
    { name: "首页", url: `${siteConfig.url}/` },
    { name: "测试文章", url: `${siteConfig.url}/posts/test/` },
  ],
};

describe("SEO metadata", () => {
  it("formats titles by page type", () => {
    expect(pageTitle(websiteMeta)).toBe(siteConfig.title);
    expect(pageTitle({ ...websiteMeta, type: "webpage", title: "关于" })).toBe(
      `关于 | ${siteConfig.title}`,
    );
  });

  it("uses the site image only when a page image is absent", () => {
    expect(pageImage(websiteMeta)).toBe(`${siteConfig.url}/og/site.png`);
    expect(pageImage(articleMeta)).toBe(`${siteConfig.url}/og/test.png`);
  });

  it("maps article pages to the article Open Graph type", () => {
    expect(ogType(articleMeta)).toBe("article");
    expect(ogType({ ...websiteMeta, type: "webpage" })).toBe("website");
  });

  it("builds article and breadcrumb JSON-LD nodes", () => {
    const graph = buildJsonLd(articleMeta)["@graph"] as Array<Record<string, unknown>>;
    const article = graph.find((node) => node["@type"] === "BlogPosting");
    const breadcrumb = graph.find((node) => node["@type"] === "BreadcrumbList");

    expect(article).toMatchObject({
      headline: articleMeta.title,
      datePublished: articleMeta.publishedTime,
      keywords: articleMeta.tags,
      image: { url: articleMeta.image, width: 1200, height: 630 },
    });
    expect(breadcrumb).toMatchObject({
      itemListElement: [
        { position: 1, name: "首页", item: `${siteConfig.url}/` },
        { position: 2, name: "测试文章", item: articleMeta.url },
      ],
    });
  });
});
