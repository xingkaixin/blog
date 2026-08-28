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
};

export function tagSlug(tag: string): string {
  const canonical = canonicalTag(tag);
  if (!canonical) {
    throw new Error("tag must not be empty");
  }
  // Astro 会反复解码路由；保留字符使用可逆标识，避免路径碰撞与目录穿越。
  if (
    /[%\\/;?:@&=+$,#]/.test(canonical) ||
    canonical.startsWith("~") ||
    canonical === "." ||
    canonical === ".."
  ) {
    return `~${Array.from(new TextEncoder().encode(canonical), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")}`;
  }
  return canonical;
}

export function tagHref(tag: string): string {
  return `/tags/${encodeURIComponent(tagSlug(tag))}/`;
}

export function buildPostTaxonomy<T extends TaggedPost>(posts: T[]): PostTaxonomy<T> {
  const groups = new Map<string, T[]>();

  for (const post of posts) {
    for (const tag of post.tags) {
      const group = groups.get(tag) ?? [];
      group.push(post);
      groups.set(tag, group);
    }
  }

  const tags: TagSummary[] = [];
  const archives: TagArchive<T>[] = [];
  for (const [tag, taggedPosts] of [...groups].toSorted(([left], [right]) =>
    left.localeCompare(right, "zh-CN"),
  )) {
    const count = taggedPosts.length;
    const href = count >= MIN_ARCHIVE_POSTS ? tagHref(tag) : null;
    tags.push({ tag, count, href });
    if (href !== null) {
      archives.push({ tag, href, posts: taggedPosts });
    }
  }
  return { archives, tags };
}

export function relatedPosts<T extends TaggedPost>(posts: T[], post: T, limit = 2): T[] {
  const postTags = new Set(post.tags);
  return posts
    .filter(
      (candidate) =>
        candidate.slug !== post.slug && candidate.tags.some((tag) => postTags.has(tag)),
    )
    .slice(0, limit);
}
