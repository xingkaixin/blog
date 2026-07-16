import type { PublishedPost } from "@/lib/post-schema";

export type SearchIndexItem = PublishedPost;

type SearchParams = {
  query: string;
  activeTag: string | null;
};

const normalize = (value: string) => value.trim().toLowerCase();

let searchIndexCache: SearchIndexItem[] | null = null;

export function resetSearchCache() {
  searchIndexCache = null;
}

export async function loadSearchIndex(): Promise<SearchIndexItem[]> {
  if (searchIndexCache) {
    return searchIndexCache;
  }

  const response = await fetch("/search-index.json");
  if (!response.ok) {
    throw new Error(`Failed to load search index: ${response.status}`);
  }

  const data = (await response.json()) as SearchIndexItem[];
  searchIndexCache = data;
  return data;
}

export function rankPosts(posts: SearchIndexItem[], { query, activeTag }: SearchParams) {
  const normalizedQuery = normalize(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return posts
    .filter((post) => (activeTag ? post.tags.includes(activeTag) : true))
    .map((post) => {
      const haystack = `${post.title} ${post.summary} ${post.tags.join(" ")}`.toLowerCase();
      const score = terms.reduce((total, term) => {
        const titleBoost = post.title.toLowerCase().includes(term) ? 6 : 0;
        const tagBoost = post.tags.some((tag) => tag.toLowerCase().includes(term)) ? 4 : 0;
        const summaryBoost = post.summary.toLowerCase().includes(term) ? 3 : 0;
        const bodyBoost = haystack.includes(term) ? 1 : 0;
        return total + titleBoost + tagBoost + summaryBoost + bodyBoost;
      }, 0);

      return { post, score };
    })
    .filter(({ score, post }) => {
      if (!terms.length) {
        return activeTag ? post.tags.includes(activeTag) : true;
      }
      return score > 0;
    })
    .toSorted(
      (left, right) => right.score - left.score || right.post.date.localeCompare(left.post.date),
    )
    .map(({ post }) => post);
}

export async function searchPosts(params: SearchParams) {
  return rankPosts(await loadSearchIndex(), params);
}
