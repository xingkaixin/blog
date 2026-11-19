import { getPublishedPosts, toPostListItem } from "@/lib/astro-posts";
import { renderFeedXml } from "@/lib/feed";

export async function GET() {
  const posts = (await getPublishedPosts()).map((entry) => ({
    post: toPostListItem(entry),
    body: entry.body ?? "",
  }));

  return new Response(await renderFeedXml(posts, "all"), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
