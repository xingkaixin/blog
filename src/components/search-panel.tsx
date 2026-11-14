import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { localeFromLang } from "@/lib/i18n";
import { chromeMessages } from "@/lib/messages/chrome";
import { loadSearchIndex, type SearchIndexItem } from "@/lib/search";
import { buildSearchPalette, type SearchPaletteItem } from "@/lib/search-palette";
import { THEME_TOGGLE_EVENT } from "@/lib/site-events";
import { siteShortcuts } from "@/lib/site-shortcuts";
import { OPEN_STAMPS_EVENT } from "@/lib/stamps";
import { cn } from "@/lib/utils";

export type SearchOpenSource = "pointer" | "keyboard";

type SearchPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: SearchOpenSource;
  onSourceChange?: (source: SearchOpenSource) => void;
  triggerElement?: HTMLElement | null;
};

const SEARCH_ORIGIN_VARS = [
  "--search-origin-x",
  "--search-origin-y",
  "--search-origin-sx",
  "--search-origin-sy",
] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isDesktopSearchViewport(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(min-width: 640px)").matches;
}

function getCssEasing(token: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function clearSearchOriginVars(element: HTMLElement): void {
  for (const name of SEARCH_ORIGIN_VARS) {
    element.style.removeProperty(name);
  }
}

export function SearchPanel({
  open,
  onOpenChange,
  source = "keyboard",
  onSourceChange,
  triggerElement = null,
}: SearchPanelProps) {
  const [locale] = useState(() => localeFromLang(document.documentElement.lang));
  const t = chromeMessages[locale];
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<SearchIndexItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const [popupMounted, setPopupMounted] = useState(false);
  const mountedRef = useRef(true);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const suppressReturnFocusRef = useRef(false);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const itemAnimationsRef = useRef(new Map<HTMLElement, Animation>());
  const pendingFlipTopsRef = useRef<Map<string, number> | null>(null);
  const keyboardInset = useKeyboardInset(open);

  const handlePopupRef = useCallback((node: HTMLDivElement | null) => {
    popupRef.current = node;
    setPopupMounted(node !== null);
  }, []);

  const cancelItemAnimations = useCallback(() => {
    for (const anim of itemAnimationsRef.current.values()) {
      anim.cancel();
    }
    itemAnimationsRef.current.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelItemAnimations();
    };
  }, [cancelItemAnimations]);

  useEffect(() => {
    if (open) {
      suppressReturnFocusRef.current = false;
      return;
    }
    pendingFlipTopsRef.current = null;
    cancelItemAnimations();
    setQuery("");
    setActiveIndex(0);
  }, [cancelItemAnimations, open]);

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

  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!open || !popupMounted || !popup) {
      return;
    }

    if (
      source !== "pointer" ||
      !isDesktopSearchViewport() ||
      !triggerElement ||
      !triggerElement.isConnected
    ) {
      clearSearchOriginVars(popup);
      return;
    }

    const triggerRect = triggerElement.getBoundingClientRect();
    if (triggerRect.width <= 0 || triggerRect.height <= 0) {
      clearSearchOriginVars(popup);
      return;
    }

    const hasStartingStyle = popup.hasAttribute("data-starting-style");
    popup.style.transition = "none";
    popup.style.transform = "none";
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.width > 0 && popupRect.height > 0) {
      const dx = triggerRect.left + triggerRect.width / 2 - (popupRect.left + popupRect.width / 2);
      const dy = triggerRect.top + triggerRect.height / 2 - (popupRect.top + popupRect.height / 2);
      const sx = triggerRect.width / popupRect.width;
      const sy = triggerRect.height / popupRect.height;
      popup.style.setProperty("--search-origin-x", `${dx}px`);
      popup.style.setProperty("--search-origin-y", `${dy}px`);
      popup.style.setProperty("--search-origin-sx", `${sx}`);
      popup.style.setProperty("--search-origin-sy", `${sy}`);
    } else {
      clearSearchOriginVars(popup);
    }
    popup.style.removeProperty("transform");
    if (hasStartingStyle) {
      void popup.offsetWidth;
    }
    popup.style.removeProperty("transition");
  }, [open, popupMounted, source, triggerElement]);

  const groups = useMemo(
    () => buildSearchPalette(query, status === "loaded" ? posts : null, locale),
    [locale, posts, query, status],
  );

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const itemIndexById = useMemo(
    () => new Map(items.map((item, index) => [item.id, index])),
    [items],
  );
  const currentIndex = activeIndex < items.length ? activeIndex : 0;
  const activeItem = items[currentIndex];

  useLayoutEffect(() => {
    const beforeTopById = pendingFlipTopsRef.current;
    pendingFlipTopsRef.current = null;
    cancelItemAnimations();

    if (!open || !beforeTopById || beforeTopById.size === 0 || prefersReducedMotion()) {
      return;
    }

    const duration = isDesktopSearchViewport() ? 120 : 160;
    const easing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");
    for (const [id, element] of itemRefs.current) {
      if (typeof element.animate !== "function") {
        continue;
      }
      const beforeTop = beforeTopById.get(id);
      if (beforeTop === undefined) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      if (rect.height === 0) {
        continue;
      }
      const dy = beforeTop - rect.top;
      if (Math.abs(dy) < 0.5) {
        continue;
      }
      const anim = element.animate(
        [{ transform: `translate3d(0, ${dy}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
        { duration, easing },
      );
      itemAnimationsRef.current.set(element, anim);
      void anim.finished
        .catch(() => {})
        .finally(() => {
          if (itemAnimationsRef.current.get(element) === anim) {
            itemAnimationsRef.current.delete(element);
          }
        });
    }
  }, [cancelItemAnimations, groups, open]);

  useEffect(() => {
    if (open && activeItem) {
      itemRefs.current.get(activeItem.id)?.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeItem, open]);

  const switchToKeyboardSource = () => {
    popupRef.current?.setAttribute("data-search-source", "keyboard");
    onSourceChange?.("keyboard");
  };

  const closeImmediately = () => {
    switchToKeyboardSource();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean, eventDetails: { reason?: string }) => {
    if (
      !nextOpen &&
      eventDetails.reason !== "outside-press" &&
      eventDetails.reason !== "close-press"
    ) {
      switchToKeyboardSource();
    }
    onOpenChange(nextOpen);
  };

  const captureItemTops = () => {
    if (prefersReducedMotion()) {
      pendingFlipTopsRef.current = null;
      return;
    }
    const tops = new Map<string, number>();
    for (const [id, element] of itemRefs.current) {
      const rect = element.getBoundingClientRect();
      if (rect.height > 0) {
        tops.set(id, rect.top);
      }
    }
    pendingFlipTopsRef.current = tops;
  };

  const activate = (item: SearchPaletteItem | undefined, animate = false) => {
    if (!item) {
      return;
    }
    if (item.kind !== "link") {
      if (item.kind === "stamps") {
        suppressReturnFocusRef.current = true;
      }
      closeImmediately();
      window.dispatchEvent(
        item.kind === "theme"
          ? new CustomEvent(THEME_TOGGLE_EVENT, { detail: { animate } })
          : new Event(OPEN_STAMPS_EVENT),
      );
      return;
    }
    switchToKeyboardSource();
    itemRefs.current.get(item.id)?.click();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // 部分输入法在候选词确认时已结束组合状态，但键码仍是 229。
    if (items.length === 0 || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((currentIndex + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      activate(activeItem);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        ref={handlePopupRef}
        data-command-palette
        data-search-source={source}
        title={t.commandPalette}
        description={t.search.description}
        finalFocus={() => {
          if (suppressReturnFocusRef.current) {
            return false;
          }
          if (triggerElement?.isConnected) {
            return triggerElement;
          }
          return true;
        }}
        style={{ "--keyboard-inset": `${keyboardInset}px` } as CSSProperties}
        className="pointer-events-none fixed bottom-0 left-0 top-auto max-h-none w-full max-w-none translate-x-0 translate-y-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none sm:bottom-auto sm:left-1/2 sm:top-[16dvh] sm:w-[min(620px,calc(100vw-2rem))] sm:-translate-x-1/2"
      >
        <div
          style={{ transform: "translate3d(0, calc(var(--keyboard-inset, 0px) * -1), 0)" }}
          className="pointer-events-auto flex max-h-[min(82dvh,calc(100dvh-var(--keyboard-inset)-3rem))] w-full flex-col overflow-hidden rounded-t-[18px] border border-line bg-surface shadow-[0_-20px_60px_-32px_rgba(20,21,26,0.55)] sm:rounded-[14px] sm:shadow-[0_30px_70px_-34px_rgba(20,21,26,0.55)]"
        >
          <div className="flex shrink-0 justify-center pb-1 pt-2 sm:hidden" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-ink-200" />
          </div>

          <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line px-4">
            <MagnifyingGlassIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-600" />
            <input
              aria-label={t.search.inputLabel}
              aria-controls="command-palette-results"
              aria-activedescendant={activeItem?.id}
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(event) => {
                captureItemTops();
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={t.searchLong}
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink-800 outline-none placeholder:text-ink-400"
            />
            {query.trim() && (
              <span aria-hidden="true" className="shrink-0 font-mono text-[10px] text-ink-400">
                {t.search.results(items.length)}
              </span>
            )}
            <span aria-live="polite" className="sr-only">
              {query.trim() ? t.search.results(items.length) : ""}
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 text-sm text-ink-500 sm:hidden"
            >
              {t.search.cancel}
            </button>
          </div>

          <div
            id="command-palette-results"
            role="listbox"
            aria-label={t.search.resultsLabel}
            className="min-h-0 overflow-y-auto sm:max-h-[430px]"
          >
            {groups.length > 0 ? (
              <div className="min-h-64 py-1.5">
                {groups.map((group) => (
                  <section key={group.id} aria-label={group.label}>
                    <p className="px-4 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const itemIndex = itemIndexById.get(item.id) ?? 0;
                      const selected = itemIndex === currentIndex;
                      const selectOnPointerMove = (event: PointerEvent<HTMLElement>) => {
                        if (event.pointerType === "mouse") {
                          setActiveIndex(itemIndex);
                        }
                      };
                      const setItemRef = (element: HTMLElement | null) => {
                        if (element) {
                          itemRefs.current.set(item.id, element);
                        } else {
                          itemRefs.current.delete(item.id);
                        }
                      };
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
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[10px] text-ink-400",
                              item.kind === "theme" && "pointer-coarse:hidden",
                            )}
                          >
                            {item.hint}
                          </span>
                        </>
                      );

                      return item.kind === "link" ? (
                        <a
                          ref={setItemRef}
                          id={item.id}
                          key={item.id}
                          href={item.href}
                          data-astro-reload={item.reload ? "" : undefined}
                          role="option"
                          aria-selected={selected}
                          className={itemClassName}
                          onPointerMove={selectOnPointerMove}
                          onFocus={() => setActiveIndex(itemIndex)}
                          onClick={() => closeImmediately()}
                        >
                          {content}
                        </a>
                      ) : (
                        <button
                          ref={setItemRef}
                          id={item.id}
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={itemClassName}
                          onPointerMove={selectOnPointerMove}
                          onFocus={() => setActiveIndex(itemIndex)}
                          onClick={(event) => activate(item, event.detail > 0)}
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
                    <span className="text-xs text-ink-500">{t.search.postsFailed}</span>
                    <Button variant="ghost" onClick={() => setStatus("idle")}>
                      {t.retry}
                    </Button>
                  </div>
                )}
              </div>
            ) : status === "loading" ? (
              <PaletteLoading label={t.search.loading} />
            ) : status === "failed" ? (
              <div
                role="alert"
                className="flex min-h-64 flex-col items-center justify-center px-6 text-center"
              >
                <p className="text-base text-ink-800">{t.search.indexFailed}</p>
                <p className="mt-2 text-sm text-ink-500">{t.search.indexFailedHint}</p>
                <Button variant="secondary" className="mt-4" onClick={() => setStatus("idle")}>
                  {t.search.reload}
                </Button>
              </div>
            ) : status === "loaded" ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <p className="text-base text-ink-800">{t.search.noResults}</p>
                <p className="mt-2 text-sm text-ink-500">{t.search.noResultsHint}</p>
              </div>
            ) : null}
          </div>

          <div className="hidden h-10 shrink-0 items-center gap-5 border-t border-line bg-ink-50 px-4 font-mono text-[10px] text-ink-400 sm:pointer-fine:flex">
            <span>⏎ {t.search.open}</span>
            <span>↑↓ {t.search.move}</span>
            <span>
              {siteShortcuts.theme.hint} {t.flipWorld}
            </span>
            <span className="ml-auto">esc {t.search.close}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaletteLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2 px-4 py-4">
      <span className="block h-2.5 w-20 bg-ink-100" />
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} aria-hidden="true" className="block h-10 bg-ink-50 even:bg-ink-100/60" />
      ))}
    </div>
  );
}
