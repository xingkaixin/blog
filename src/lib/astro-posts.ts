import type { MarkdownHeading } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { tocFromHeadings, type TocItem } from "@/lib/markdown";
import { isPublishedFrontmatter } from "@/lib/post-schema";
import {
  comparePublishedPostsNewestFirst,
  toPublishedPost,
  type PublishedPost,
} from "@/lib/published-post";

export type BlogPostEntry = CollectionEntry<"posts">;

export type BlogPostDetail = PublishedPost & {
  toc: TocItem[];
};

export function toPostListItem(post: BlogPostEntry): PublishedPost {
  return toPublishedPost(post.id, post.data);
}

export function toPostDetail(post: BlogPostEntry, headings: MarkdownHeading[]): BlogPostDetail {
  return {
    ...toPostListItem(post),
    toc: tocFromHeadings(headings),
  };
}

export async function getPublishedPosts(): Promise<BlogPostEntry[]> {
  const posts: BlogPostEntry[] = await getCollection("posts", (entry: BlogPostEntry) =>
    isPublishedFrontmatter(entry.data),
  );
  return posts.toSorted((left, right) => comparePublishedPostsNewestFirst(left.data, right.data));
}
