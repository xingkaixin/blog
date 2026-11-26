import type { Locale } from "@/lib/i18n";
import { parseSearchIndex, type SearchIndexItem } from "@/lib/search-index";
import { normalizeSearchText, searchTerms } from "@/lib/search-text";

export type { SearchIndexItem } from "@/lib/search-index";

type SearchParams = {
  query: string;
};

const searchIndexRequests: Partial<Record<Locale, Promise<SearchIndexItem[]>>> = {};

export function resetSearchCache(): void {
  delete searchIndexRequests.zh;
  delete searchIndexRequests.en;
}

export async function loadSearchIndex(locale: Locale = "zh"): Promise<SearchIndexItem[]> {
  const existing = searchIndexRequests[locale];
  if (existing) {
    return existing;
  }

  const indexPath = locale === "en" ? "/search-index-en.json" : "/search-index.json";
  const request = fetch(indexPath, { cache: "no-cache" }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load search index: ${response.status}`);
    }
    return parseSearchIndex(await response.json());
  });
  searchIndexRequests[locale] = request;
  try {
    return await request;
  } catch (error) {
    if (searchIndexRequests[locale] === request) {
      delete searchIndexRequests[locale];
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
      const headings = (post.headings ?? []).map(normalizeSearchText);
      const termScores = terms.map((term) => {
        const titleBoost = title.includes(term) ? 6 : 0;
        const tagBoost = tags.some((tag) => tag.includes(term)) ? 4 : 0;
        const headingBoost = headings.some((heading) => heading.includes(term)) ? 3.5 : 0;
        const summaryBoost = summary.includes(term) ? 3 : 0;
        return titleBoost + tagBoost + headingBoost + summaryBoost;
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

export function matchPostSnippet(post: SearchIndexItem, query: string): string | undefined {
  const terms = searchTerms(query);
  if (terms.length === 0) {
    return undefined;
  }

  const normalizedTitle = normalizeSearchText(post.title);
  const titleCoversAll = terms.every((term) => normalizedTitle.includes(term));

  const matchedHeading = (post.headings ?? []).find((heading) => {
    const normalized = normalizeSearchText(heading);
    return terms.some((term) => normalized.includes(term));
  });
  if (matchedHeading && !titleCoversAll) {
    return `§ ${matchedHeading}`;
  }

  const normalizedSummary = normalizeSearchText(post.summary);
  if (terms.some((term) => normalizedSummary.includes(term))) {
    return post.summary;
  }

  if (matchedHeading) {
    return `§ ${matchedHeading}`;
  }

  const matchedTag = post.tags.find((tag) => {
    const normalized = normalizeSearchText(tag);
    return terms.some((term) => normalized.includes(term));
  });
  if (matchedTag && !titleCoversAll) {
    return `#${matchedTag}`;
  }

  return undefined;
}

export type HighlightSegment = {
  start: number;
  text: string;
  matched: boolean;
};

export function highlightSearchText(text: string, query: string): HighlightSegment[] {
  const terms = searchTerms(query).toSorted((left, right) => right.length - left.length);
  if (terms.length === 0 || text.length === 0) {
    return [{ start: 0, text, matched: false }];
  }

  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(term, from);
      if (index === -1) {
        break;
      }
      ranges.push([index, index + term.length]);
      from = index + term.length;
    }
  }

  if (ranges.length === 0) {
    return [{ start: 0, text, matched: false }];
  }

  ranges.sort((left, right) => left[0] - right[0] || right[1] - left[1]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const previous = merged.at(-1);
    if (!previous || start > previous[1]) {
      merged.push([start, end]);
    } else if (end > previous[1]) {
      previous[1] = end;
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ start: cursor, text: text.slice(cursor, start), matched: false });
    }
    segments.push({ start, text: text.slice(start, end), matched: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ start: cursor, text: text.slice(cursor), matched: false });
  }
  return segments;
}
