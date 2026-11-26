import type { MarkdownHeading } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import type { Locale } from "@/lib/i18n";
import { isPublishedFrontmatter } from "@/lib/post-schema";
import { tocFromHeadings, type TocItem } from "@/lib/post-toc";
import {
  comparePublishedPostsNewestFirst,
  toPublishedPost,
  type PublishedPost,
} from "@/lib/published-post";

export type BlogPostEntry = CollectionEntry<"posts">;
export type BlogPostTranslationEntry = CollectionEntry<"postsEn">;
export type LocalizedPostContentEntry = CollectionEntry<"posts" | "postsEn">;

export type LocalizedBlogPostEntry = {
  slug: string;
  locale: Locale;
  post: PublishedPost;
  body: string;
  contentEntry: LocalizedPostContentEntry;
};

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

export function toLocalizedPostDetail(
  entry: LocalizedBlogPostEntry,
  headings: MarkdownHeading[],
): BlogPostDetail {
  return {
    ...entry.post,
    toc: tocFromHeadings(headings),
  };
}

export async function getPublishedPosts(): Promise<BlogPostEntry[]> {
  const posts: BlogPostEntry[] = await getCollection("posts", (entry: BlogPostEntry) =>
    isPublishedFrontmatter(entry.data),
  );
  return posts.toSorted((left, right) =>
    comparePublishedPostsNewestFirst(
      { date: left.data.date, slug: left.id },
      { date: right.data.date, slug: right.id },
    ),
  );
}

export async function getLocalizedPublishedPosts(
  locale: Locale,
): Promise<LocalizedBlogPostEntry[]> {
  const posts = await getPublishedPosts();
  if (locale === "zh") {
    return posts.map((entry) => ({
      slug: entry.id,
      locale: "zh",
      post: toPostListItem(entry),
      body: entry.body ?? "",
      contentEntry: entry,
    }));
  }

  const translations = await getCollection("postsEn");
  const translationsBySlug = new Map(translations.map((entry) => [entry.id, entry]));

  return posts.map((entry) => {
    const translation = translationsBySlug.get(entry.id);
    if (!translation) {
      throw new Error(`Missing English translation for published post "${entry.id}"`);
    }
    return {
      slug: entry.id,
      locale: "en",
      post: toPublishedPost(entry.id, {
        ...entry.data,
        title: translation.data.title,
        summary: translation.data.summary,
        coverAlt: translation.data.coverAlt,
      }),
      body: translation.body ?? "",
      contentEntry: translation,
    };
  });
}
