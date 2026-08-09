import { parsePublishedPosts, type PublishedPost } from "@/lib/published-post";
import { normalizeSearchText, searchTerms } from "@/lib/search-text";

export type SearchIndexItem = PublishedPost;

type SearchParams = {
  query: string;
};

let searchIndexRequest: Promise<SearchIndexItem[]> | null = null;

export function resetSearchCache(): void {
  searchIndexRequest = null;
}

export async function loadSearchIndex(): Promise<SearchIndexItem[]> {
  if (searchIndexRequest) {
    return searchIndexRequest;
  }

  const request = fetch("/search-index.json", { cache: "no-cache" }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load search index: ${response.status}`);
    }
    return parsePublishedPosts(await response.json());
  });
  searchIndexRequest = request;
  try {
    return await request;
  } catch (error) {
    if (searchIndexRequest === request) {
      searchIndexRequest = null;
    }
    throw error;
  }
}

export function rankPosts(posts: SearchIndexItem[], { query }: SearchParams): SearchIndexItem[] {
  const terms = searchTerms(query);

  return posts
    .map((post) => {
      const title = normalizeSearchText(post.title);
      const summary = normalizeSearchText(post.summary);
      const tags = post.tags.map(normalizeSearchText);
      const termScores = terms.map((term) => {
        const titleBoost = title.includes(term) ? 6 : 0;
        const tagBoost = tags.some((tag) => tag.includes(term)) ? 4 : 0;
        const summaryBoost = summary.includes(term) ? 3 : 0;
        return titleBoost + tagBoost + summaryBoost;
      });

      return {
        post,
        matched: termScores.every((score) => score > 0),
        score: termScores.reduce((total, score) => total + score, 0),
      };
    })
    .filter(({ matched }) => matched)
    .toSorted(
      (left, right) => right.score - left.score || right.post.date.localeCompare(left.post.date),
    )
    .map(({ post }) => post);
}
