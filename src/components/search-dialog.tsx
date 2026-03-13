import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlassIcon, ReaderIcon } from "@radix-ui/react-icons";
import { formatDisplayDate, getAllPosts } from "@/lib/content";
import { searchPosts } from "@/lib/search";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type SearchDialogProps = {
  trigger: ReactNode;
};

const posts = getAllPosts();

export function SearchDialog({ trigger }: SearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
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
  }, []);

  const results = useMemo(() => searchPosts(posts, { query, activeTag: null }).slice(0, 8), [query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-ink-400">站内检索</p>
            <h2 className="mt-2 text-2xl tracking-tight text-balance text-ink-800">搜标题、标签、摘要和正文片段</h2>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-600">关键词</span>
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                name="site-search"
                autoComplete="off"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如：vite、阅读、工作流…"
                className="pl-11"
              />
            </div>
          </label>
          <Separator />
          {!query.trim() ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {posts.slice(0, 4).map((post) => (
                <Link
                  key={post.slug}
                  to={`/posts/${post.slug}`}
                  onClick={() => setOpen(false)}
                  className="rounded-[1.5rem] border border-ink-800/10 bg-white/70 p-4 transition-[transform,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-accent/30"
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-ink-400">{formatDisplayDate(post.date)}</p>
                  <p className="mt-2 text-lg tracking-tight text-ink-800">{post.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-7 text-ink-600">{post.summary}</p>
                </Link>
              ))}
            </div>
          ) : results.length ? (
            <div className="grid gap-3">
              {results.map((post) => (
                <Link
                  key={post.slug}
                  to={`/posts/${post.slug}`}
                  onClick={() => setOpen(false)}
                  className="rounded-[1.4rem] border border-ink-800/10 bg-white/70 px-4 py-4 transition-[transform,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-accent/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg tracking-tight text-ink-800">{post.title}</p>
                      <p className="mt-2 text-sm leading-7 text-ink-600">{post.summary}</p>
                    </div>
                    <ReaderIcon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-ink-400" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-ink-800/15 bg-white/60 px-5 py-8 text-center">
              <p className="text-lg tracking-tight text-ink-800">没有命中结果</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">
                试试更短的词，或者改搜标签与概念名。
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
