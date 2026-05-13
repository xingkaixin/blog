import { getCollection, type CollectionEntry } from "astro:content";
import { estimateReadingTime, extractPlainText, extractToc, type TocItem } from "@/lib/markdown";

export type BlogPostEntry = CollectionEntry<"posts">;

export type BlogPostMeta = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string;
  coverAlt: string;
  readingTime: number;
  toc: TocItem[];
};

export function toDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function toPostMeta(post: BlogPostEntry): BlogPostMeta {
  const plainText = extractPlainText(post.body);

  return {
    slug: post.id,
    title: post.data.title,
    date: toDateValue(post.data.date),
    summary: post.data.summary,
    tags: post.data.tags,
    cover: post.data.cover,
    coverAlt: post.data.coverAlt,
    readingTime: estimateReadingTime(plainText),
    toc: extractToc(post.body),
  };
}

export async function getPublishedPosts() {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts.toSorted((left, right) => right.data.date.getTime() - left.data.date.getTime());
}
