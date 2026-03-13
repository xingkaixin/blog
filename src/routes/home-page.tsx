import { PostList } from "@/components/post-list";
import { PostSkeleton } from "@/components/post-skeleton";
import { Badge } from "@/components/ui/badge";
import { getAllPosts } from "@/lib/content";

const posts = getAllPosts();

export function HomePage() {
  if (!posts.length) {
    return (
      <section className="px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-ink-400">内容加载中</p>
            <h1 className="text-4xl tracking-[-0.05em] text-ink-800">文章索引正在准备</h1>
          </div>
          <PostSkeleton />
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 pb-20 pt-10 sm:px-6 lg:px-10 lg:pt-14">
      <div className="mx-auto max-w-[1400px] space-y-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-ink-400">Articles</p>
            <h1 className="mt-2 text-3xl tracking-[-0.04em] text-ink-800 sm:text-4xl">所有文章</h1>
          </div>
          <Badge className="w-fit border-[#d5ccbe] bg-white/85 text-ink-500">
            {posts.length} 篇文章
          </Badge>
        </div>
        <PostList posts={posts} />
      </div>
    </section>
  );
}
