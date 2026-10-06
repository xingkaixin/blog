import { getPublishedPosts, toPostListItem } from "@/lib/astro-posts";
import { buildFeed } from "@/lib/feed";

export async function GET() {
  const posts = (await getPublishedPosts()).map(toPostListItem);

  return new Response(buildFeed(posts));
}
