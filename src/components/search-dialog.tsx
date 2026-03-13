import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { getAllPosts } from "@/lib/content";
import { searchPosts } from "@/lib/search";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type SearchDialogProps = {
  trigger: ReactNode;
};

const posts = getAllPosts();

function PostItem({ post, onClose }: { post: (typeof posts)[number]; onClose: () => void }) {
  return (
    <Link
      to={`/posts/${post.slug}`}
      onClick={onClose}
      className="flex gap-3 rounded-[1.4rem] border border-ink-800/10 bg-white/70 p-3 transition-[transform,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-accent/30"
    >
      {post.cover && (
        <img
          src={post.cover}
          alt={post.coverAlt}
          className="h-16 w-20 shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-lg tracking-tight text-ink-800">{post.title}</p>
        <p className="mt-1 line-clamp-2 text-sm leading-7 text-ink-600">{post.summary}</p>
      </div>
    </Link>
  );
}

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

  const displayPosts = !query.trim() ? posts.slice(0, 5) : results;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent hideClose>
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
          {displayPosts.length > 0 ? (
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {displayPosts.map((post) => (
                <PostItem key={post.slug} post={post} onClose={() => setOpen(false)} />
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
