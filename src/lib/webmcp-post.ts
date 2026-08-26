import type { PublishedPost } from "./published-post";
import { parseSearchIndex, toSearchIndexItem, type SearchIndexItem } from "./search-index";

export type WebMcpPost = SearchIndexItem & {
  content: string;
};

export function toWebMcpPost(post: PublishedPost, content: string): WebMcpPost {
  if (content.trim().length === 0) {
    throw new Error("post content must not be empty");
  }

  return {
    ...toSearchIndexItem(post),
    content,
  };
}

export function parseWebMcpPost(value: unknown): WebMcpPost {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("webMcpPost must be an object");
  }

  const content = (value as Record<string, unknown>).content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("webMcpPost.content must be a non-empty string");
  }

  return {
    ...parseSearchIndex([value])[0],
    content,
  };
}
