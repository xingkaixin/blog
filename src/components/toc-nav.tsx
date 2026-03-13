import type { TocItem } from "@/lib/content";
import { cn } from "@/lib/utils";

export function TocNav({ items }: { items: TocItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-[1.7rem] border border-ink-800/10 bg-white/60 p-5 text-sm leading-7 text-ink-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        这篇文章没有二级和三级标题，适合一口气读完。
      </div>
    );
  }

  return (
    <>
      <div className="hidden rounded-[1.9rem] border border-white/20 bg-white/70 p-5 shadow-[0_18px_40px_-35px_rgba(31,24,18,0.4),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl lg:block">
        <p className="mb-4 text-xs uppercase tracking-[0.28em] text-ink-400">文章目录</p>
        <nav className="space-y-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "block rounded-xl px-3 py-2 text-sm text-ink-500 transition-colors hover:bg-accent/8 hover:text-ink-800",
                item.depth === 3 && "ml-4"
              )}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
      <details className="rounded-[1.5rem] border border-ink-800/10 bg-white/70 p-5 lg:hidden">
        <summary className="cursor-pointer list-none text-sm font-medium text-ink-700">展开目录</summary>
        <nav className="mt-4 space-y-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn("block text-sm text-ink-500", item.depth === 3 && "ml-4")}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </details>
    </>
  );
}
