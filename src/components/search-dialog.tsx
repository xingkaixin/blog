import { SearchIcon } from "lucide-react";
import {
  cloneElement,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";

const SearchPanel = lazy(() =>
  import("@/components/search-panel").then((module) => ({ default: module.SearchPanel })),
);

type TriggerElement = ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>;

type SearchDialogProps = {
  trigger?: TriggerElement;
};

type PanelState = "unmounted" | "open" | "closed";

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

export function SearchDialog({ trigger }: SearchDialogProps) {
  const [panelState, setPanelState] = useState<PanelState>("unmounted");
  const openPanel = useCallback(() => setPanelState("open"), []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const commandShortcut = (event.metaKey || event.ctrlKey) && key === "k";
      const slashShortcut = !event.metaKey && !event.ctrlKey && !event.altKey && key === "/";
      if (!commandShortcut && !slashShortcut) {
        return;
      }

      event.preventDefault();
      openPanel();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [openPanel]);

  return (
    <>
      {trigger ? (
        cloneElement(trigger, {
          onClick: (event: MouseEvent<HTMLElement>) => {
            trigger.props.onClick?.(event);
            openPanel();
          },
        })
      ) : (
        <button
          type="button"
          onClick={openPanel}
          className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-line bg-paper px-2.5 text-left transition-[border-color,background-color] hover:border-ink-300 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:px-3"
        >
          <SearchIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-400 sm:hidden">
            搜索 · 跳转
          </span>
          <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-ink-400 sm:block">
            搜索文章、跳转页面、切换世界…
          </span>
          <kbd className="hidden shrink-0 rounded-[4px] border border-ink-200 bg-surface px-1.5 py-0.5 font-mono text-[10px] font-normal text-ink-400 sm:inline-flex">
            ⌘K
          </kbd>
        </button>
      )}

      {panelState !== "unmounted" && (
        <Suspense fallback={null}>
          <SearchPanel
            open={panelState === "open"}
            onOpenChange={(open) => setPanelState(open ? "open" : "closed")}
          />
        </Suspense>
      )}
    </>
  );
}
