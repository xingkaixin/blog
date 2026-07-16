import type { PublishedPost } from "./post-schema";

const MIN_ARCHIVE_POSTS = 2;

type TaggedPost = Pick<PublishedPost, "tags">;

export type TagArchive<T extends TaggedPost = PublishedPost> = {
  tag: string;
  posts: T[];
};

export function buildTagArchives<T extends TaggedPost>(posts: T[]): TagArchive<T>[] {
  const groups = new Map<string, T[]>();

  for (const post of posts) {
    for (const tag of post.tags) {
      const group = groups.get(tag) ?? [];
      group.push(post);
      groups.set(tag, group);
    }
  }

  return [...groups]
    .filter(([, taggedPosts]) => taggedPosts.length >= MIN_ARCHIVE_POSTS)
    .map(([tag, taggedPosts]) => ({ tag, posts: taggedPosts }))
    .toSorted((left, right) => left.tag.localeCompare(right.tag, "zh-CN"));
}

export function tagHref(tag: string) {
  return `/tags/${encodeURIComponent(tag)}/`;
}
