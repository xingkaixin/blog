import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { resolveCover } from "@/lib/covers";
import { loadSearchIndex, rankPosts, type SearchIndexItem } from "@/lib/search";

type SearchDialogProps = {
  trigger?: ReactElement<{ children?: ReactNode }>;
  enableShortcut?: boolean;
};

function PostItem({ post, onClose }: { post: SearchIndexItem; onClose: () => void }) {
  const cover = resolveCover(post.cover);

  return (
    <a
      href={`/posts/${post.slug}/`}
      onClick={onClose}
      className="flex gap-3 rounded-[1.4rem] border border-line bg-surface p-3 transition-[border-color,background-color] duration-(--duration-quick) ease-(--ease-smooth-out) hover:border-accent/40 hover:bg-ink-50"
    >
      {post.cover && (
        <img
          src={cover?.mobile ?? post.cover}
          alt={post.coverAlt}
          width={80}
          height={64}
          loading="lazy"
          className="h-16 w-20 shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-lg text-ink-800">{post.title}</p>
        <p className="mt-1 line-clamp-2 text-sm leading-7 text-ink-600">{post.summary}</p>
      </div>
    </a>
  );
}

export function SearchDialog({ trigger, enableShortcut = true }: SearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<SearchIndexItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "failed">("idle");

  useEffect(() => {
    if (open && status === "idle") {
      setStatus("loading");
      void loadSearchIndex()
        .then((index) => {
          setPosts(index);
          setStatus("loaded");
        })
        .catch(() => {
          setStatus("failed");
        });
    }
  }, [open, status]);

  useEffect(() => {
    if (!enableShortcut) {
      return undefined;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const isTypingTarget =
        event.target instanceof HTMLElement &&
        (event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.isContentEditable);

      if (isTypingTarget) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [enableShortcut]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    return rankPosts(posts, { query });
  }, [query, posts]);

  const displayPosts = !query.trim() ? posts.slice(0, 5) : results;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button variant="secondary" size="sm" />}>
        {trigger ? (
          trigger.props.children
        ) : (
          <>
            <SearchIcon aria-hidden="true" className="h-4 w-4" />
            搜索文章
            <span className="hidden rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[0.7rem] text-ink-500 sm:inline-flex">
              /
            </span>
          </>
        )}
      </DialogTrigger>
      <DialogContent hideClose title="搜索文章" description="输入关键词搜索博客文章">
        <div className="space-y-4">
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-600"
            />
            <Input
              aria-label="搜索文章"
              name="site-search"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文章…"
              className="pl-11"
            />
          </div>
          <div style={{ height: 360 }}>
            {status === "loading" ? (
              <div
                role="status"
                aria-live="polite"
                className="flex h-full items-center justify-center"
              >
                <div
                  aria-hidden="true"
                  className="h-6 w-6 animate-spin rounded-full border-b-2 border-ink-800 motion-reduce:animate-none"
                />
                <span className="sr-only">正在加载搜索索引…</span>
              </div>
            ) : status === "failed" ? (
              <div
                role="alert"
                className="flex h-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-line bg-ink-50 px-5 py-8 text-center"
              >
                <p className="text-lg text-ink-800">搜索索引加载失败</p>
                <p className="mt-2 text-sm text-ink-600">请检查网络连接后重试。</p>
                <Button className="mt-4" onClick={() => setStatus("idle")}>
                  重新加载
                </Button>
              </div>
            ) : displayPosts.length > 0 ? (
              <div aria-live="polite" className="h-full space-y-2 overflow-y-auto">
                {displayPosts.map((post) => (
                  <PostItem key={post.slug} post={post} onClose={() => setOpen(false)} />
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-line bg-ink-50 px-5 py-8 text-center">
                <p className="text-lg text-ink-800">没有命中结果</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">
                  试试更短的词，或者改搜标签与概念名。
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
