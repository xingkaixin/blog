import { siteConfig } from "@/lib/site";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export type PageMeta = {
  title: string;
  description: string;
  url: string;
  image?: string;
  type: "website" | "webpage" | "article";
  publishedTime?: string;
  tags?: string[];
};

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
    url: siteConfig.url,
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

export function buildJsonLd(meta: PageMeta) {
  if (meta.type === "website") {
    return {
      "@context": "https://schema.org",
      "@graph": [personSchema(), websiteSchema()],
    };
  }

  if (meta.type === "webpage") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        personSchema(),
        websiteSchema(),
        {
          "@type": "WebPage",
          "@id": meta.url,
          url: meta.url,
          name: meta.title,
          description: meta.description,
          inLanguage: siteConfig.language,
          isPartOf: { "@id": `${siteConfig.url}/#website` },
          author: { "@id": `${siteConfig.url}/#person` },
        },
      ],
    };
  }

  const articleId = `${meta.url}#article`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      personSchema(),
      websiteSchema(),
      {
        "@type": "WebPage",
        "@id": meta.url,
        url: meta.url,
        name: meta.title,
        description: meta.description,
        inLanguage: siteConfig.language,
        isPartOf: { "@id": `${siteConfig.url}/#website` },
        author: { "@id": `${siteConfig.url}/#person` },
        primaryEntity: { "@id": articleId },
      },
      {
        "@type": "BlogPosting",
        "@id": articleId,
        name: meta.title,
        headline: meta.title,
        description: meta.description,
        inLanguage: siteConfig.language,
        datePublished: meta.publishedTime,
        dateModified: meta.publishedTime,
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
        keywords: meta.tags ?? [],
      },
    ],
  };
}

export function ogType(meta: PageMeta) {
  return meta.type === "article" ? "article" : "website";
}

export { OG_HEIGHT, OG_WIDTH };
