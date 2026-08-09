import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ProjectStickers } from "@/components/project-stickers";
import { resolveCover } from "@/lib/covers";
import type { ReadingMetrics } from "@/lib/markdown";
import type { PublishedPost } from "@/lib/post-schema";
import { buildPostTaxonomy } from "@/lib/post-tags";
import { postHref } from "@/lib/published-post";
import { cn } from "@/lib/utils";

export type PostConsoleItem = PublishedPost & ReadingMetrics;

type PostConsoleProps = {
  posts: PostConsoleItem[];
};

function PostPreview({ post, related }: { post: PostConsoleItem; related: PostConsoleItem[] }) {
  const cover = resolveCover(post.cover);

  return (
    <aside className="hidden border-l border-line bg-surface p-[18px] xl:block">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
        预览 · 悬停即换
      </p>
      <a
        href={postHref(post.slug)}
        className="mt-3 block overflow-hidden rounded-[10px] border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {cover ? (
          <picture className="block">
            <source srcSet={`${cover.mobile} 1x, ${cover.desktop} 2x`} />
            <img
              src={cover.desktop}
              alt={post.coverAlt}
              width={400}
              className="block h-auto w-full"
            />
          </picture>
        ) : (
          <img src={post.cover} alt={post.coverAlt} width={400} className="block h-auto w-full" />
        )}
      </a>
      <h2 className="mt-3.5 text-lg font-medium leading-7 text-ink-800">
        <a href={postHref(post.slug)} className="transition-colors hover:text-accent">
          {post.title}
        </a>
      </h2>
      <p className="mt-2 line-clamp-5 text-[13px] leading-6 text-ink-600">{post.summary}</p>
      <dl className="mt-4 grid gap-1.5 font-mono text-[10px] text-ink-400">
        <div className="flex justify-between gap-3">
          <dt>字数</dt>
          <dd className="text-ink-600">{post.wordCount.toLocaleString("zh-CN")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>阅读</dt>
          <dd className="text-ink-600">{post.readingMinutes} min</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>标签</dt>
          <dd className="max-w-44 truncate text-right text-ink-600">{post.tags.join(" · ")}</dd>
        </div>
      </dl>

      {related.length > 0 && (
        <div className="mt-4 border-t border-line pt-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">同标签</p>
          <div className="mt-2 space-y-1.5">
            {related.map((item) => (
              <a
                key={item.slug}
                href={postHref(item.slug)}
                className="line-clamp-2 text-[13px] leading-6 text-ink-600 transition-colors hover:text-accent"
              >
                {item.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export function PostConsole({ posts }: PostConsoleProps) {
  const years = useMemo(() => [...new Set(posts.map((post) => post.date.slice(0, 4)))], [posts]);
  const taxonomy = useMemo(() => buildPostTaxonomy(posts), [posts]);
  const popularTags = useMemo(
    () =>
      taxonomy.tags
        .toSorted(
          (left, right) => right.count - left.count || left.tag.localeCompare(right.tag, "zh-CN"),
        )
        .slice(0, 9),
    [taxonomy],
  );
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState(posts[0]?.slug ?? "");
  const listRef = useRef<HTMLDivElement>(null);
  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          (!selectedYear || post.date.startsWith(selectedYear)) &&
          (!selectedTag || post.tags.includes(selectedTag)),
      ),
    [posts, selectedTag, selectedYear],
  );
  const previewPost = filteredPosts.find((post) => post.slug === previewSlug) ?? filteredPosts[0];
  const relatedPosts = previewPost ? taxonomy.relatedTo(previewPost, 2) : [];
  const totalWords = posts.reduce((sum, post) => sum + post.wordCount, 0);

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (filteredPosts.length === 0 || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) {
      return;
    }
    event.preventDefault();
    const currentIndex = Math.max(
      0,
      filteredPosts.findIndex((post) => post.slug === previewPost?.slug),
    );
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + direction + filteredPosts.length) % filteredPosts.length;
    const nextPost = filteredPosts[nextIndex];
    setPreviewSlug(nextPost.slug);
    listRef.current
      ?.querySelector<HTMLAnchorElement>(`[data-post-row="${nextPost.slug}"]`)
      ?.focus();
  };

  return (
    <section className="mx-auto max-w-320">
      <div className="border-b border-line px-3 py-2 lg:hidden">
        <div
          role="group"
          aria-label="按年份筛选文章"
          className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-pressed={selectedYear === null}
            onClick={() => setSelectedYear(null)}
            className="shrink-0 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink-500 aria-pressed:border-ink-800 aria-pressed:bg-ink-800 aria-pressed:text-paper"
          >
            全部年份
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              aria-pressed={selectedYear === year}
              onClick={() => setSelectedYear(year)}
              className="shrink-0 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink-500 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
            >
              {year}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="按标签筛选文章"
          className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-pressed={selectedTag === null}
            onClick={() => setSelectedTag(null)}
            className="shrink-0 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink-500 aria-pressed:border-ink-800 aria-pressed:bg-ink-800 aria-pressed:text-paper"
          >
            全部
          </button>
          {popularTags.slice(0, 6).map(({ tag }) => (
            <button
              key={tag}
              type="button"
              aria-pressed={selectedTag === tag}
              onClick={() => setSelectedTag((current) => (current === tag ? null : tag))}
              className="shrink-0 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink-500 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:grid lg:min-h-[calc(100dvh-90px)] lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="hidden border-r border-line px-[18px] py-5 lg:flex lg:flex-col lg:gap-6">
          <div>
            <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              年份
            </p>
            <div className="space-y-0.5">
              <button
                type="button"
                aria-pressed={selectedYear === null}
                onClick={() => setSelectedYear(null)}
                className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-[13px] text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800 aria-pressed:bg-ink-100 aria-pressed:font-medium aria-pressed:text-ink-800"
              >
                <span>全部</span>
                <span className="font-mono text-[10px] text-ink-400">{posts.length}</span>
              </button>
              {years.map((year) => {
                const count = posts.filter((post) => post.date.startsWith(year)).length;
                return (
                  <button
                    key={year}
                    type="button"
                    aria-pressed={selectedYear === year}
                    onClick={() => setSelectedYear(year)}
                    className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-[13px] text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800 aria-pressed:bg-ink-100 aria-pressed:font-medium aria-pressed:text-ink-800"
                  >
                    <span>{year}</span>
                    <span className="font-mono text-[10px] text-ink-400">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              标签
            </p>
            <div className="flex flex-wrap gap-1.5">
              {popularTags.map(({ tag }) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selectedTag === tag}
                  onClick={() => setSelectedTag((current) => (current === tag ? null : tag))}
                  className="rounded-[5px] border border-line bg-surface px-1.5 py-1 font-mono text-[10px] tracking-[0.03em] text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto border-t border-line pt-4">
            <p className="font-mono text-[10px] leading-5 text-ink-400">
              {posts.length} 篇 · {totalWords.toLocaleString("zh-CN")} 字
              <br />
              最近更新 {posts[0]?.date ?? "-"}
            </p>
            <div className="relative mt-2.5 h-9 overflow-hidden">
              <ProjectStickers />
            </div>
          </div>
        </aside>

        <div className="min-w-0 py-2.5">
          <div className="hidden items-center justify-between gap-4 border-b border-line px-5 pb-2.5 lg:flex">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              {selectedTag ?? "全部文章"} · 按时间倒序
            </p>
            <span className="font-mono text-[10px] text-ink-400">↑↓ 移动 · ⏎ 打开</span>
          </div>

          <div
            ref={listRef}
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            aria-label="文章日志"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
          >
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => {
                const active = previewPost?.slug === post.slug;
                return (
                  <a
                    key={post.slug}
                    data-post-row={post.slug}
                    href={postHref(post.slug)}
                    onMouseEnter={() => setPreviewSlug(post.slug)}
                    onFocus={() => setPreviewSlug(post.slug)}
                    className={cn(
                      "group block border-b border-ink-100 transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40",
                      active && "bg-surface shadow-[inset_3px_0_0_var(--accent)]",
                    )}
                  >
                    <span className="block px-3 py-3.5 lg:hidden">
                      <span className="flex items-center gap-2 font-mono text-[10px] text-ink-400">
                        <span>{post.date}</span>
                        <span className="text-ink-200">·</span>
                        <span>{post.readingMinutes} 分钟</span>
                        {post.tags[0] && (
                          <>
                            <span className="text-ink-200">·</span>
                            <span className="text-accent">{post.tags[0]}</span>
                          </>
                        )}
                      </span>
                      <span className="mt-1 block text-[15px] leading-6 text-ink-800">
                        {post.title}
                      </span>
                    </span>

                    <span className="hidden items-center gap-3 px-5 py-2.5 lg:flex">
                      <span className="w-[76px] shrink-0 font-mono text-[10px] text-ink-400">
                        {post.date}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] leading-6 text-ink-800 group-hover:text-accent">
                        {post.title}
                      </span>
                      <span className="hidden shrink-0 gap-1.5 2xl:flex">
                        {post.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-[4px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[9px] tracking-[0.04em] text-ink-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                      <span className="w-9 shrink-0 text-right font-mono text-[10px] text-ink-300">
                        {post.readingMinutes}′
                      </span>
                    </span>
                  </a>
                );
              })
            ) : (
              <div className="flex min-h-64 items-center justify-center px-6 text-center">
                <div>
                  <p className="text-base text-ink-800">没有符合条件的文章</p>
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="mt-3 rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink-600"
                  >
                    清除标签筛选
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {previewPost && <PostPreview post={previewPost} related={relatedPosts} />}
      </div>
    </section>
  );
}
