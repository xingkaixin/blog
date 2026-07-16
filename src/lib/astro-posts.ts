import { getCollection, type CollectionEntry } from "astro:content";
import { extractToc, type TocItem } from "@/lib/markdown";
import { toDateValue, type PublishedPost } from "@/lib/post-schema";

export type BlogPostEntry = CollectionEntry<"posts">;

export type BlogPostDetail = PublishedPost & {
  toc: TocItem[];
};

export function toPostListItem(post: BlogPostEntry): PublishedPost {
  return {
    slug: post.id,
    title: post.data.title,
    date: toDateValue(post.data.date),
    summary: post.data.summary,
    tags: post.data.tags,
    cover: post.data.cover,
    coverAlt: post.data.coverAlt,
  };
}

export function toPostDetail(post: BlogPostEntry): BlogPostDetail {
  return {
    ...toPostListItem(post),
    toc: extractToc(post.body),
  };
}

export async function getPublishedPosts() {
  const posts = await getCollection("posts", (entry: BlogPostEntry) => !entry.data.draft);
  return posts.toSorted(
    (left: BlogPostEntry, right: BlogPostEntry) =>
      right.data.date.getTime() - left.data.date.getTime(),
  );
}
