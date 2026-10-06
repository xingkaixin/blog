import { getPublishedPosts, toPostListItem } from "@/lib/astro-posts";
import { buildSitemap } from "@/lib/sitemap";

export async function GET() {
  const posts = (await getPublishedPosts()).map(toPostListItem);

  return new Response(buildSitemap(posts));
}
