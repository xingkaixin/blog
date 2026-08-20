import { canonicalTag } from "./post-tag";
import type { PublishedPost } from "./published-post";

const MIN_ARCHIVE_POSTS = 2;

type TaggedPost = Pick<PublishedPost, "slug" | "tags">;

export type TagArchive<T extends TaggedPost = PublishedPost> = {
  tag: string;
  href: string;
  posts: T[];
};

export type TagSummary = {
  tag: string;
  count: number;
  href: string | null;
};

export type PostTaxonomy<T extends TaggedPost = PublishedPost> = {
  archives: TagArchive<T>[];
  tags: TagSummary[];
  isArchived(tag: string): boolean;
  relatedTo(post: T, limit?: number): T[];
};

export function tagHref(tag: string): string {
  const canonical = canonicalTag(tag);
  if (!canonical) {
    throw new Error("tag must not be empty");
  }
  return `/tags/${encodeURIComponent(canonical)}/`;
}

export function buildPostTaxonomy<T extends TaggedPost>(posts: T[]): PostTaxonomy<T> {
  const groups = new Map<string, T[]>();

  for (const post of posts) {
    for (const tag of new Set(post.tags.map(canonicalTag))) {
      const group = groups.get(tag) ?? [];
      group.push(post);
      groups.set(tag, group);
    }
  }

  const tags = [...groups]
    .map(([tag, taggedPosts]): TagSummary => {
      const count = taggedPosts.length;
      return { tag, count, href: count >= MIN_ARCHIVE_POSTS ? tagHref(tag) : null };
    })
    .toSorted((left, right) => left.tag.localeCompare(right.tag, "zh-CN"));
  const archivedTags = new Set(tags.filter(({ href }) => href !== null).map(({ tag }) => tag));
  const archives = [...groups]
    .filter(([, taggedPosts]) => taggedPosts.length >= MIN_ARCHIVE_POSTS)
    .map(([tag, taggedPosts]) => ({ tag, href: tagHref(tag), posts: taggedPosts }))
    .toSorted((left, right) => left.tag.localeCompare(right.tag, "zh-CN"));

  return {
    archives,
    tags,
    isArchived: (tag) => archivedTags.has(canonicalTag(tag)),
    relatedTo: (post, limit = Number.POSITIVE_INFINITY) =>
      relatedPosts(posts, post).slice(0, limit),
  };
}

function relatedPosts<T extends TaggedPost>(posts: T[], post: T): T[] {
  const postTags = new Set(post.tags.map(canonicalTag));
  return posts.filter(
    (candidate) =>
      candidate.slug !== post.slug && candidate.tags.some((tag) => postTags.has(canonicalTag(tag))),
  );
}
