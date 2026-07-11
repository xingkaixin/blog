import { ChevronLeftIcon, MenuIcon, RocketIcon, SearchIcon, UserIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { SearchDialog } from "@/components/search-dialog";
import { cn } from "@/lib/utils";

type MobileHeaderMenuProps = {
  currentPath: string;
};

const menuItem =
  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export function MobileHeaderMenu({ currentPath }: MobileHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
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
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      firstItemRef.current?.focus();
    }
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={menuRef} className="relative sm:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-700 transition-[transform,border-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]"
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
        <nav aria-label="移动端导航" className="space-y-1">
          {showBack && (
            <a ref={firstItemRef} href="/" onClick={closeMenu} className={menuItem}>
              <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
              返回
            </a>
          )}
          {showProjects && (
            <a
              ref={!showBack ? firstItemRef : undefined}
              href="/projects/"
              onClick={closeMenu}
              className={menuItem}
            >
              <RocketIcon aria-hidden="true" className="h-4 w-4" />
              工具箱
            </a>
          )}
          {showAbout && (
            <a
              ref={!showBack && !showProjects ? firstItemRef : undefined}
              href="/about/"
              onClick={closeMenu}
              className={menuItem}
            >
              <UserIcon aria-hidden="true" className="h-4 w-4" />
              关于
            </a>
          )}
          <SearchDialog
            enableShortcut={false}
            trigger={
              <button type="button" onClick={() => setOpen(false)} className={menuItem}>
                <SearchIcon aria-hidden="true" className="h-4 w-4" />
                搜索文章
              </button>
            }
          />
        </nav>
      </div>
    </div>
  );
}
