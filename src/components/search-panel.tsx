import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { loadSearchIndex, type SearchIndexItem } from "@/lib/search";
import { buildSearchPalette, type SearchPaletteItem } from "@/lib/search-palette";
import { THEME_TOGGLE_EVENT } from "@/lib/site-events";
import { cn } from "@/lib/utils";

type SearchPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SearchPanel({ open, onOpenChange }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<SearchIndexItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const mountedRef = useRef(true);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open || status !== "idle") {
      return;
    }

    setStatus("loading");
    void loadSearchIndex()
      .then((index) => {
        if (mountedRef.current) {
          setPosts(index);
          setStatus("loaded");
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setStatus("failed");
        }
      });
  }, [open, status]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const groups = useMemo(
    () => buildSearchPalette(query, status === "loaded" ? posts : null),
    [posts, query, status],
  );

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const itemIndexById = useMemo(
    () => new Map(items.map((item, index) => [item.id, index])),
    [items],
  );
  const activeItem = items[activeIndex] ?? items[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [query, status]);

  const activate = (item: SearchPaletteItem | undefined) => {
    if (!item) {
      return;
    }
    if (item.kind === "theme") {
      window.dispatchEvent(new Event(THEME_TOGGLE_EVENT));
      onOpenChange(false);
      return;
    }
    itemRefs.current.get(item.id)?.click();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // 部分输入法在候选词确认时已结束组合状态，但键码仍是 229。
    if (items.length === 0 || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      activate(activeItem);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        title="命令面板"
        description="搜索文章与项目、跳转页面或执行站点命令"
        className="command-palette fixed bottom-0 left-0 top-auto max-h-[82dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-[18px] border border-line bg-surface p-0 shadow-[0_-20px_60px_-32px_rgba(20,21,26,0.55)] sm:bottom-auto sm:left-1/2 sm:top-[16dvh] sm:w-[min(620px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-[14px] sm:shadow-[0_30px_70px_-34px_rgba(20,21,26,0.55)]"
      >
        <div className="flex justify-center pb-1 pt-2 sm:hidden" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-ink-200" />
        </div>

        <div className="flex h-[52px] items-center gap-3 border-b border-line px-4">
          <SearchIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-600" />
          <input
            autoFocus
            aria-label="搜索与命令"
            aria-controls="command-palette-results"
            aria-activedescendant={activeItem?.id}
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="搜索文章、项目、页面或命令…"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink-800 outline-none placeholder:text-ink-400"
          />
          {query.trim() && (
            <span className="shrink-0 font-mono text-[10px] text-ink-400">
              {items.length} 个结果
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 text-sm text-ink-500 sm:hidden"
          >
            取消
          </button>
        </div>

        <div
          id="command-palette-results"
          role="listbox"
          aria-label="命令面板结果"
          className="min-h-64 overflow-y-auto sm:max-h-[430px]"
        >
          {groups.length > 0 ? (
            <div aria-live="polite" className="py-1.5">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <p className="px-4 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const itemIndex = itemIndexById.get(item.id) ?? 0;
                    const selected = itemIndex === activeIndex;
                    const itemClassName = cn(
                      "flex min-h-10 w-full items-center gap-2.5 px-4 py-2 text-left transition-colors",
                      selected
                        ? "bg-ink-50 text-ink-800 shadow-[inset_2px_0_0_var(--accent)]"
                        : "text-ink-700 hover:bg-ink-50",
                    );
                    const content = (
                      <>
                        <span className="w-4 shrink-0 font-mono text-[11px] text-ink-300">
                          {item.glyph}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                        <span className="shrink-0 font-mono text-[10px] text-ink-400">
                          {item.hint}
                        </span>
                      </>
                    );

                    return item.kind === "link" ? (
                      <a
                        ref={(element) => {
                          if (element) {
                            itemRefs.current.set(item.id, element);
                          } else {
                            itemRefs.current.delete(item.id);
                          }
                        }}
                        id={item.id}
                        key={item.id}
                        href={item.href}
                        data-astro-reload={item.reload ? "" : undefined}
                        role="option"
                        aria-selected={selected}
                        className={itemClassName}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onFocus={() => setActiveIndex(itemIndex)}
                        onClick={() => onOpenChange(false)}
                      >
                        {content}
                      </a>
                    ) : (
                      <button
                        id={item.id}
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={itemClassName}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onFocus={() => setActiveIndex(itemIndex)}
                        onClick={() => activate(item)}
                      >
                        {content}
                      </button>
                    );
                  })}
                </section>
              ))}
              {status === "failed" && (
                <div
                  role="alert"
                  className="mx-4 my-2 flex items-center justify-between gap-3 rounded-[6px] border border-line bg-ink-50 px-3 py-2"
                >
                  <span className="text-xs text-ink-500">文章索引加载失败</span>
                  <Button variant="ghost" size="sm" onClick={() => setStatus("idle")}>
                    重试
                  </Button>
                </div>
              )}
            </div>
          ) : status === "loading" ? (
            <PaletteLoading />
          ) : status === "failed" ? (
            <div
              role="alert"
              className="flex min-h-64 flex-col items-center justify-center px-6 text-center"
            >
              <p className="text-base text-ink-800">搜索索引加载失败</p>
              <p className="mt-2 text-sm text-ink-500">检查网络连接后可以重新加载。</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => setStatus("idle")}
              >
                重新加载
              </Button>
            </div>
          ) : status === "loaded" ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <p className="text-base text-ink-800">没有命中结果</p>
              <p className="mt-2 text-sm text-ink-500">试试更短的关键词、标签或项目名。</p>
            </div>
          ) : null}
        </div>

        <div className="hidden h-10 items-center gap-5 border-t border-line bg-ink-50 px-4 font-mono text-[10px] text-ink-400 sm:flex">
          <span>⏎ 打开</span>
          <span>↑↓ 移动</span>
          <span>⌘J 翻转世界</span>
          <span className="ml-auto">esc 关闭</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaletteLoading() {
  return (
    <div role="status" aria-label="正在加载搜索索引" className="space-y-2 px-4 py-4">
      <span className="block h-2.5 w-20 bg-ink-100" />
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} aria-hidden="true" className="block h-10 bg-ink-50 even:bg-ink-100/60" />
      ))}
    </div>
  );
}
