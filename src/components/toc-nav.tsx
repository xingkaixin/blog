import { useEffect, useRef } from "react";
import type { TocItem } from "@/lib/content";
import { cn } from "@/lib/utils";

export function TocNav({ items, activeId }: { items: TocItem[]; activeId?: string | null }) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  // 当 activeId 变化时，将高亮项滚动到目录容器中心
  useEffect(() => {
    if (activeRef.current && navRef.current) {
      const nav = navRef.current;
      const activeItem = activeRef.current;

      // 计算需要将高亮项置于容器中心所需的滚动偏移
      const navHeight = nav.clientHeight;
      const itemTop = activeItem.offsetTop;
      const itemHeight = activeItem.clientHeight;

      // 目标位置：让高亮项位于容器垂直中心
      const targetScrollTop = itemTop - navHeight / 2 + itemHeight / 2;

      nav.scrollTo({
        top: targetScrollTop,
        behavior: "smooth",
      });
    }
  }, [activeId]);

  if (!items.length) {
    return null;
  }

  return (
    <>
      <div
        ref={navRef}
        className="hidden rounded-[1.9rem] border border-white/20 bg-white/70 p-5 shadow-[0_18px_40px_-35px_rgba(31,24,18,0.4),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl lg:block lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
      >
        <p className="mb-4 text-xs uppercase tracking-[0.28em] text-ink-400">导览</p>
        <nav className="space-y-2">
          {items.map((item) => {
            const isActive = item.id === activeId;

            return (
              <a
                key={item.id}
                ref={isActive ? activeRef : undefined}
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block rounded-xl border border-transparent px-3 py-2 text-sm text-ink-500 transition-all hover:bg-accent/8 hover:text-ink-800",
                  item.depth === 3 && "ml-4",
                  isActive &&
                    "border-accent/12 bg-accent/10 font-semibold text-ink-800 shadow-[inset_3px_0_0_rgba(123,98,68,0.7)]",
                )}
              >
                {item.text}
              </a>
            );
          })}
        </nav>
      </div>
      <details className="rounded-[1.5rem] border border-ink-800/10 bg-white/70 p-5 lg:hidden">
        <summary className="cursor-pointer list-none text-sm font-medium text-ink-700">
          展开导览
        </summary>
        <nav className="mt-4 space-y-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={item.id === activeId ? "location" : undefined}
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
