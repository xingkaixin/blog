import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { PostCover } from "@/components/post-cover";
import { ReadingProgress } from "@/components/reading-progress";
import { TocNav } from "@/components/toc-nav";
import { Badge } from "@/components/ui/badge";
import { formatDisplayDate, getPostBySlug, type PostDetail } from "@/lib/content";
import { resolveCover } from "@/lib/covers";
import { SignatureAnimation } from "@/components/signature-animation";
import { siteConfig } from "@/lib/site";
import { TOC_ACTIVE_OFFSET } from "@/lib/toc-active";

export function PostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    void getPostBySlug(slug)
      .then((data) => {
        setPost(data ?? null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    setActiveId(post?.toc[0]?.id ?? null);
  }, [post?.slug, post?.toc]);

  useEffect(() => {
    if (!post?.toc.length) {
      return;
    }

    const tocIds = post.toc.map((item) => item.id);

    function updateActiveHeading() {
      // 每次滚动时重新查询 DOM，避免过期引用
      const headings = tocIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));

      if (!headings.length) {
        return;
      }

      // 从后往前找第一个已过线的标题
      for (let i = headings.length - 1; i >= 0; i--) {
        const rect = headings[i].getBoundingClientRect();
        if (rect.top <= TOC_ACTIVE_OFFSET) {
          setActiveId(headings[i].id);
          return;
        }
      }
      // 所有标题都在 offset 下方，高亮第一个
      setActiveId(headings[0].id);
    }

    updateActiveHeading();

    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActiveHeading);
    };
  }, [post?.slug, post?.toc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!post) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="pb-20">
      <ReadingProgress />
      <section className="px-4 pt-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1400px]">
          <div
            className={`grid gap-10 lg:items-start ${post.toc.length ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}
          >
            <article className="space-y-8">
              <figure className="overflow-hidden rounded-[2.4rem] border border-white/20 bg-white/70 p-4 shadow-[0_30px_80px_-50px_rgba(31,24,18,0.62),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl sm:p-5">
                <PostCover
                  src={post.cover}
                  alt={post.coverAlt}
                  priority
                  responsive={resolveCover(post.cover)}
                  className="rounded-[2rem] border-white/60"
                />
              </figure>

              <div className="space-y-5">
                <h1 className="max-w-[24ch] text-4xl tracking-[-0.05em] text-ink-800 sm:max-w-[28ch] sm:text-5xl lg:max-w-[32ch] lg:text-6xl">
                  {post.title}
                </h1>
                <div className="flex flex-col gap-4 border-y border-ink-800/8 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm uppercase tracking-[0.2em] text-ink-400">
                    {formatDisplayDate(post.date)}
                  </span>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {post.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[2.3rem] border border-white/20 bg-white/72 px-6 py-8 shadow-[0_24px_70px_-50px_rgba(31,24,18,0.55),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl sm:px-10">
                <MarkdownRenderer content={post.content} />
              </div>

              <div className="relative rounded-[2rem] border border-ink-800/10 bg-white/50 px-6 py-8 sm:px-10">
                <svg
                  aria-hidden="true"
                  className="absolute right-6 top-6 h-8 w-8 text-ink-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <text
                    x="12"
                    y="16"
                    textAnchor="middle"
                    fill="currentColor"
                    stroke="none"
                    fontSize="13"
                    fontWeight="500"
                    fontFamily="system-ui, sans-serif"
                  >
                    C
                  </text>
                </svg>
                <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-ink-400">
                  版权声明
                </h2>
                <dl className="mt-5 grid gap-3 text-sm text-ink-600">
                  <div className="flex gap-3">
                    <dt className="shrink-0 font-medium text-ink-500">作者</dt>
                    <dd>{siteConfig.author}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="shrink-0 font-medium text-ink-500">标题</dt>
                    <dd>{post.title}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="shrink-0 font-medium text-ink-500">发布时间</dt>
                    <dd>{formatDisplayDate(post.date)}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="shrink-0 font-medium text-ink-500">文章链接</dt>
                    <dd>
                      <a
                        href={`${siteConfig.url}/posts/${post.slug}`}
                        className="text-ink-800 underline underline-offset-2 hover:text-ink-500"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {siteConfig.url}/posts/{post.slug}
                      </a>
                    </dd>
                  </div>
                </dl>
                <p className="mt-6 text-sm text-ink-500">
                  本作品采用
                  <a
                    href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh-hans"
                    className="text-ink-800 underline underline-offset-2 hover:text-ink-500"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CC BY-NC-ND 4.0 DEED
                  </a>
                  许可。
                </p>
                <SignatureAnimation />
              </div>
            </article>

            {post.toc.length > 0 && (
              <aside className="lg:sticky lg:top-28 lg:self-start lg:pt-2 lg:z-10">
                <div>
                  <TocNav items={post.toc} activeId={activeId} />
                </div>
              </aside>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
