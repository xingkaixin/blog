import { useEffect, useState } from "react";
import { PostList } from "@/components/post-list";
import { PostSkeleton } from "@/components/post-skeleton";
import { getAllPosts, type PostDetail } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export function HomePage() {
  const [posts, setPosts] = useState<PostDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getAllPosts()
      .then((data) => {
        setPosts(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
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

  if (!posts.length) {
    return (
      <section className="px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-ink-400">暂无文章</p>
            <h1 className="text-4xl tracking-[-0.05em] text-ink-800">还没有发布文章</h1>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 pb-20 pt-10 sm:px-6 lg:px-10 lg:pt-14">
      <div className="mx-auto max-w-[1400px] space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-ink-400">Articles</p>
          <h1 className="mt-3 text-4xl tracking-[-0.05em] text-ink-800 sm:text-5xl">
            {siteConfig.title}
          </h1>
          <p className="mt-3 max-w-[44ch] text-base leading-8 text-ink-600">
            {siteConfig.description}
          </p>
        </div>
        <PostList posts={posts} />
      </div>
    </section>
  );
}
