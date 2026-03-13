import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { PostCover } from "@/components/post-cover";
import { ReadingProgress } from "@/components/reading-progress";
import { TocNav } from "@/components/toc-nav";
import { Badge } from "@/components/ui/badge";
import { formatDisplayDate, getPostBySlug } from "@/lib/content";
import { resolveActiveTocId, TOC_ACTIVE_OFFSET } from "@/lib/toc-active";

export function PostPage() {
  const { slug } = useParams();
  const post = slug ? getPostBySlug(slug) : undefined;
  const [activeId, setActiveId] = useState<string | null>(post?.toc[0]?.id ?? null);

  useEffect(() => {
    setActiveId(post?.toc[0]?.id ?? null);
  }, [post?.slug, post?.toc]);

  useEffect(() => {
    if (!post?.toc.length) {
      return;
    }

    const tocIds = post.toc.map((item) => item.id);
    const headings = post.toc
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => Boolean(heading));

    if (!headings.length) {
      return;
    }

    const visibleIds = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const headingId = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) {
            visibleIds.add(headingId);
          } else {
            visibleIds.delete(headingId);
          }
        }

        setActiveId((currentId) => {
          const nextActiveId = resolveActiveTocId(tocIds, visibleIds, currentId);
          return currentId === nextActiveId ? currentId : nextActiveId;
        });
      },
      {
        rootMargin: `-${TOC_ACTIVE_OFFSET}px 0px -70% 0px`,
        threshold: 0,
      }
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => {
      observer.disconnect();
    };
  }, [post?.slug, post?.toc]);

  if (!post) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="pb-20">
      <ReadingProgress />
      <section className="px-4 pt-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            <article className="space-y-8">
              <figure className="overflow-hidden rounded-[2.4rem] border border-white/20 bg-white/70 p-4 shadow-[0_30px_80px_-50px_rgba(31,24,18,0.62),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl sm:p-5">
                <PostCover
                  src={post.cover}
                  alt={post.coverAlt}
                  priority
                  className="rounded-[2rem] border-white/60"
                />
              </figure>

              <div className="space-y-5">
                <h1 className="max-w-[24ch] text-4xl tracking-[-0.05em] text-ink-800 sm:max-w-[28ch] sm:text-5xl lg:max-w-[32ch] lg:text-6xl">
                  {post.title}
                </h1>
                <div className="flex flex-col gap-4 border-y border-ink-800/8 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm uppercase tracking-[0.2em] text-ink-400">{formatDisplayDate(post.date)}</span>
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
            </article>

            <aside className="lg:sticky lg:top-28 lg:self-start lg:pt-2 lg:z-10">
              <div>
                <TocNav items={post.toc} activeId={activeId} />
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
