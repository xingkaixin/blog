import type { PostDetail } from "@/lib/content";

type SearchParams = {
  query: string;
  activeTag: string | null;
};

const normalize = (value: string) => value.trim().toLowerCase();

export function searchPosts(posts: PostDetail[], { query, activeTag }: SearchParams) {
  const normalizedQuery = normalize(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return posts
    .filter((post) => (activeTag ? post.tags.includes(activeTag) : true))
    .map((post) => {
      const haystack = `${post.title} ${post.summary} ${post.tags.join(" ")} ${post.plainText}`.toLowerCase();
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
    .sort((left, right) => right.score - left.score || right.post.date.localeCompare(left.post.date))
    .map(({ post }) => post);
}
