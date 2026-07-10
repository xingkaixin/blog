import { ChevronLeftIcon, MenuIcon, RocketIcon, SearchIcon, UserIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { SearchDialog } from "@/components/search-dialog";
import { cn } from "@/lib/utils";

type MobileHeaderMenuProps = {
  currentPath: string;
};

const menuItem =
  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-800";

export function MobileHeaderMenu({ currentPath }: MobileHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const showBack = currentPath !== "/";
  const showProjects = currentPath !== "/projects";
  const showAbout = currentPath !== "/about";

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-700 transition-[transform,border-color,color] active:scale-[0.97]"
      >
        <MenuIcon aria-hidden="true" className="h-4 w-4" />
        功能
      </button>

      <div
        id={menuId}
        className={cn(
          "absolute right-0 top-12 z-30 w-56 rounded-[1.4rem] border border-line bg-surface p-2 shadow-[0_22px_60px_-36px_rgba(0,0,0,0.5)]",
          !open && "hidden",
        )}
      >
        <div className="space-y-1">
          {showBack && (
            <a href="/" onClick={() => setOpen(false)} className={menuItem}>
              <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
              返回
            </a>
          )}
          {showProjects && (
            <a href="/projects/" onClick={() => setOpen(false)} className={menuItem}>
              <RocketIcon aria-hidden="true" className="h-4 w-4" />
              工具箱
            </a>
          )}
          {showAbout && (
            <a href="/about/" onClick={() => setOpen(false)} className={menuItem}>
              <UserIcon aria-hidden="true" className="h-4 w-4" />
              关于
            </a>
          )}
          <SearchDialog
            trigger={
              <button type="button" onClick={() => setOpen(false)} className={menuItem}>
                <SearchIcon aria-hidden="true" className="h-4 w-4" />
                搜索文章
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}
