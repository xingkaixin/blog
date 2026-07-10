import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { resolveCover } from "@/lib/covers";
import { loadSearchIndex, type SearchIndexItem } from "@/lib/search";

type SearchDialogProps = {
  trigger?: ReactElement<{ children?: ReactNode }>;
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

export function SearchDialog({ trigger }: SearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<SearchIndexItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && loading) {
      void loadSearchIndex()
        .then((index) => {
          setPosts(index);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, loading]);

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

  const results = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return posts
      .map((post) => {
        const haystack = `${post.title} ${post.summary} ${post.tags.join(" ")}`.toLowerCase();
        const score = terms.reduce((total, term) => {
          const titleBoost = post.title.toLowerCase().includes(term) ? 6 : 0;
          const tagBoost = post.tags.some((tag) => tag.toLowerCase().includes(term)) ? 4 : 0;
          const summaryBoost = post.summary.toLowerCase().includes(term) ? 3 : 0;
          const bodyBoost = haystack.includes(term) ? 1 : 0;
          return total + titleBoost + tagBoost + summaryBoost + bodyBoost;
        }, 0);
        return { post, score };
      })
      .filter(({ score }) => score > 0)
      .toSorted(
        (left, right) => right.score - left.score || right.post.date.localeCompare(left.post.date),
      )
      .map(({ post }) => post);
  }, [query, posts]);

  const displayPosts = !query.trim() ? posts.slice(0, 5) : results;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button variant="secondary" size="sm" />}>
        {trigger ? (
          trigger.props.children
        ) : (
          <>
            <MagnifyingGlassIcon aria-hidden="true" className="h-4 w-4" />
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
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-600" />
            <Input
              name="site-search"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文章"
              className="pl-11"
            />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ink-800" />
            </div>
          ) : displayPosts.length > 0 ? (
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {displayPosts.map((post) => (
                <PostItem key={post.slug} post={post} onClose={() => setOpen(false)} />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-line bg-ink-50 px-5 py-8 text-center">
              <p className="text-lg text-ink-800">没有命中结果</p>
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
