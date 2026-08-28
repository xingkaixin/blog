import { siteConfig, siteContacts } from "@/lib/site";

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
  tags?: never;
  breadcrumb?: never;
};

type WebpageMeta = BasePageMeta & {
  type: "webpage";
  publishedTime?: never;
  tags?: never;
  breadcrumb?: BreadcrumbItem[];
};

type ArticleMeta = BasePageMeta & {
  type: "article";
  publishedTime: string;
  tags: string[];
  breadcrumb?: BreadcrumbItem[];
};

export type PageMeta = WebsiteMeta | WebpageMeta | ArticleMeta;

export function pageTitle(meta: PageMeta) {
  return meta.type === "website" ? meta.title : `${meta.title} | ${siteConfig.title}`;
}

export function pageImage(meta: PageMeta) {
  return meta.image ?? `${siteConfig.url}/og/site.png`;
}

function personSchema() {
  return {
    "@type": "Person",
    "@id": `${siteConfig.url}/#person`,
    name: siteConfig.author,
    url: `${siteConfig.url}/about/`,
    email: siteContacts.email.value,
    description: siteConfig.about,
    sameAs: [siteContacts.github.href, siteContacts.x.href, siteContacts.telegram.href],
  };
}

function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    name: siteConfig.title,
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

function buildGraph(meta: PageMeta) {
  const graph: unknown[] = [personSchema(), websiteSchema()];

  if (meta.type === "website") {
    return graph;
  }

  const webpageNode = {
    "@type": "WebPage",
    "@id": meta.url,
    url: meta.url,
    name: meta.title,
    description: meta.description,
    inLanguage: siteConfig.language,
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    author: { "@id": `${siteConfig.url}/#person` },
  };

  if (meta.type === "webpage") {
    graph.push(webpageNode);
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
    inLanguage: siteConfig.language,
    datePublished: meta.publishedTime,
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

export function buildJsonLd(meta: PageMeta) {
  return {
    "@context": "https://schema.org",
    "@graph": buildGraph(meta),
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
