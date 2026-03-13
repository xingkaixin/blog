import { PostCard } from "@/components/post-card";
import type { PostMeta } from "@/lib/content";

export function PostList({ posts }: { posts: PostMeta[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {posts.map((post, index) => (
        <PostCard key={post.slug} post={post} index={index} />
      ))}
    </div>
  );
}
