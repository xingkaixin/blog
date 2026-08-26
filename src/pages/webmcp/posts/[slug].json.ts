import type { APIRoute } from "astro";
import { getPublishedPosts, toPostListItem, type BlogPostEntry } from "@/lib/astro-posts";
import { toWebMcpPost } from "@/lib/webmcp-post";

type Props = {
  post: BlogPostEntry;
};

export async function getStaticPaths() {
  return (await getPublishedPosts()).map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(JSON.stringify(toWebMcpPost(toPostListItem(props.post), props.post.body)), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
