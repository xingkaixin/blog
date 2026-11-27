import { htmlLang, type Locale } from "@/lib/i18n";
import { primaryProjectUrl, type Project } from "@/lib/projects";
import { siteConfig, siteContacts, siteCopy } from "@/lib/site";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export type BreadcrumbItem = {
  name: string;
  url: string;
};

type BasePageMeta = {
  title: string;
  description: string;
  url: string;
  image?: string;
};

type WebsiteMeta = BasePageMeta & {
  type: "website";
  publishedTime?: never;
  modifiedTime?: never;
  tags?: never;
  breadcrumb?: never;
};

type WebpageMeta = BasePageMeta & {
  type: "webpage";
  publishedTime?: never;
  modifiedTime?: never;
  tags?: never;
  breadcrumb?: BreadcrumbItem[];
  projects?: readonly Project[];
};

type ArticleMeta = BasePageMeta & {
  type: "article";
  publishedTime: string;
  modifiedTime?: string;
  tags: string[];
  breadcrumb?: BreadcrumbItem[];
};

export type PageMeta = WebsiteMeta | WebpageMeta | ArticleMeta;

export function pageTitle(meta: PageMeta, locale: Locale = "zh") {
  return meta.type === "website" ? meta.title : `${meta.title} | ${siteCopy[locale].title}`;
}

export function pageImage(meta: PageMeta, locale: Locale = "zh") {
  return meta.image ?? `${siteConfig.url}/og/${locale === "en" ? "site-en" : "site"}.png`;
}

function personSchema(locale: Locale) {
  return {
    "@type": "Person",
    "@id": `${siteConfig.url}/#person`,
    name: siteConfig.author,
    url: `${siteConfig.url}/`,
    email: siteContacts.email.value,
    description: siteCopy[locale].about,
    sameAs: [siteContacts.github.href, siteContacts.x.href, siteContacts.telegram.href],
  };
}

function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    name: siteConfig.title,
    alternateName: siteCopy.en.title,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: siteConfig.language,
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
  };
}

function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function projectOperatingSystem(project: Project): string {
  const kind = project.kind.toLowerCase();
  if (kind.includes("ios")) {
    return "iOS";
  }
  if (kind.includes("桌面") || kind.includes("desktop")) {
    return "macOS, Windows";
  }
  if (kind.includes("cli")) {
    return "macOS, Linux, Windows";
  }
  return "Web";
}

function projectApplicationCategory(project: Project): string {
  const tags = project.tags.join(" ").toLowerCase();
  if (
    tags.includes("开发者") ||
    tags.includes("developer") ||
    tags.includes("cli") ||
    tags.includes("数据库") ||
    tags.includes("database")
  ) {
    return "DeveloperApplication";
  }
  return "UtilitiesApplication";
}

function projectCollectionSchemas(url: string, projects: readonly Project[], locale: Locale) {
  const listId = `${url}#itemlist`;
  return {
    listId,
    itemList: {
      "@type": "ItemList",
      "@id": listId,
      numberOfItems: projects.length,
      itemListElement: projects.map((project, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "SoftwareApplication",
          name: project.name,
          description: project.description,
          url: primaryProjectUrl(project),
          applicationCategory: projectApplicationCategory(project),
          operatingSystem: projectOperatingSystem(project),
          inLanguage: htmlLang[locale],
          author: { "@id": `${siteConfig.url}/#person` },
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
      })),
    },
  };
}

function buildGraph(meta: PageMeta, locale: Locale) {
  const graph: unknown[] = [personSchema(locale), websiteSchema()];

  if (meta.type === "website") {
    graph.push({
      "@type": "ProfilePage",
      "@id": meta.url,
      url: meta.url,
      name: meta.title,
      description: meta.description,
      inLanguage: htmlLang[locale],
      isPartOf: { "@id": `${siteConfig.url}/#website` },
      mainEntity: { "@id": `${siteConfig.url}/#person` },
    });
    return graph;
  }

  const webpageNode = {
    "@type": "WebPage",
    "@id": meta.url,
    url: meta.url,
    name: meta.title,
    description: meta.description,
    inLanguage: htmlLang[locale],
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    author: { "@id": `${siteConfig.url}/#person` },
  };

  if (meta.type === "webpage") {
    if (meta.projects && meta.projects.length > 0) {
      const { listId, itemList } = projectCollectionSchemas(meta.url, meta.projects, locale);
      graph.push({
        ...webpageNode,
        "@type": "CollectionPage",
        mainEntity: { "@id": listId },
      });
      graph.push(itemList);
    } else {
      graph.push(webpageNode);
    }
    if (meta.breadcrumb) {
      graph.push(breadcrumbSchema(meta.breadcrumb));
    }
    return graph;
  }

  const articleId = `${meta.url}#article`;
  graph.push({ ...webpageNode, primaryEntity: { "@id": articleId } });
  graph.push({
    "@type": "BlogPosting",
    "@id": articleId,
    name: meta.title,
    headline: meta.title,
    description: meta.description,
    inLanguage: htmlLang[locale],
    datePublished: meta.publishedTime,
    ...(meta.modifiedTime ? { dateModified: meta.modifiedTime } : {}),
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
    image: {
      "@type": "ImageObject",
      url: pageImage(meta),
      width: OG_WIDTH,
      height: OG_HEIGHT,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": meta.url },
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    keywords: meta.tags,
  });
  if (meta.breadcrumb) {
    graph.push(breadcrumbSchema(meta.breadcrumb));
  }
  return graph;
}

export function buildJsonLd(meta: PageMeta, locale: Locale = "zh") {
  return {
    "@context": "https://schema.org",
    "@graph": buildGraph(meta, locale),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

export function ogType(meta: PageMeta) {
  return meta.type === "article" ? "article" : "website";
}

export { OG_HEIGHT, OG_WIDTH };
