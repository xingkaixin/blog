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
import { Button } from "@/components/ui/button";

// 面板带着 Base UI 的 Dialog，是首屏最重的一块 JS。首次打开前不加载；
// 打开过之后保持挂载，关闭只切 open，已输入的关键词与已拉取的索引都不丢。
const SearchPanel = lazy(() =>
  import("@/components/search-panel").then((module) => ({ default: module.SearchPanel })),
);

type TriggerElement = ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>;

type SearchDialogProps = {
  trigger?: TriggerElement;
  enableShortcut?: boolean;
};

type PanelState = "unmounted" | "open" | "closed";

export function SearchDialog({ trigger, enableShortcut = true }: SearchDialogProps) {
  const [panelState, setPanelState] = useState<PanelState>("unmounted");

  const openPanel = useCallback(() => setPanelState("open"), []);

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
        openPanel();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [enableShortcut, openPanel]);

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
        <Button variant="secondary" size="sm" onClick={openPanel}>
          <SearchIcon aria-hidden="true" className="h-4 w-4" />
          搜索文章
          <span className="hidden rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[0.7rem] text-ink-500 sm:inline-flex">
            /
          </span>
        </Button>
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
