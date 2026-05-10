import { useEffect } from "react";
import { siteConfig } from "@/lib/site";

type PageMeta = {
  title: string;
  description: string;
  url: string;
  image?: string;
  type: "website" | "webpage" | "article";
  publishedTime?: string;
  tags?: string[];
};

const defaultImage = `${siteConfig.url}/og/site.png`;

function pageTitle(meta: PageMeta) {
  return meta.type === "website" ? meta.title : `${meta.title} | ${siteConfig.title}`;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }

  element.content = content;
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.append(element);
  }

  element.href = url;
}

function setArticleTags(tags: string[]) {
  document.head.querySelectorAll('meta[property="article:tag"]').forEach((element) => {
    element.remove();
  });

  for (const tag of tags) {
    const element = document.createElement("meta");
    element.setAttribute("property", "article:tag");
    element.content = tag;
    document.head.append(element);
  }
}

function setJsonLd(meta: PageMeta, image: string) {
  let element = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );

  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    document.head.append(element);
  }

  const person = {
    "@type": "Person",
    "@id": `${siteConfig.url}/#person`,
    name: siteConfig.author,
    url: siteConfig.url,
  };
  const website = {
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    name: siteConfig.title,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: siteConfig.language,
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
  };

  const graph: object[] = [person, website];

  if (meta.type === "webpage") {
    graph.push({
      "@type": "WebPage",
      "@id": meta.url,
      url: meta.url,
      name: meta.title,
      description: meta.description,
      inLanguage: siteConfig.language,
      isPartOf: { "@id": `${siteConfig.url}/#website` },
      author: { "@id": `${siteConfig.url}/#person` },
    });
  }

  if (meta.type === "article") {
    const articleId = `${meta.url}#article`;

    graph.push(
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
        image,
        mainEntityOfPage: { "@type": "WebPage", "@id": meta.url },
        isPartOf: { "@id": `${siteConfig.url}/#website` },
        keywords: meta.tags ?? [],
      },
    );
  }

  element.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  });
}

export function usePageMeta(meta: PageMeta | null) {
  const shouldApply = meta !== null;
  const title = meta?.title ?? "";
  const description = meta?.description ?? "";
  const url = meta?.url ?? "";
  const imageUrl = meta?.image;
  const type = meta?.type;
  const publishedTime = meta?.publishedTime;
  const tags = meta?.tags;

  useEffect(() => {
    if (!shouldApply || !type) {
      return;
    }

    const resolvedMeta: PageMeta = {
      title,
      description,
      url,
      image: imageUrl,
      type,
      publishedTime,
      tags,
    };
    const image = imageUrl ?? defaultImage;

    document.title = pageTitle(resolvedMeta);
    setMeta("name", "description", description);
    setCanonical(url);
    setMeta("property", "og:type", type === "article" ? "article" : "website");
    setMeta("property", "og:site_name", siteConfig.title);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", image);
    setMeta("property", "og:image:alt", title);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    setArticleTags(type === "article" ? (tags ?? []) : []);

    const publishedTimeElement = document.head.querySelector<HTMLMetaElement>(
      'meta[property="article:published_time"]',
    );

    if (type === "article" && resolvedMeta.publishedTime) {
      setMeta("property", "article:published_time", resolvedMeta.publishedTime);
    } else if (publishedTimeElement) {
      publishedTimeElement.remove();
    }

    setJsonLd(resolvedMeta, image);
  }, [shouldApply, title, description, url, imageUrl, type, publishedTime, tags]);
}
