import {
  FileTextIcon,
  ImagesIcon,
  MenuIcon,
  MoonStarIcon,
  RocketIcon,
  RssIcon,
  TagsIcon,
  UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { THEME_TOGGLE_EVENT } from "@/lib/site-events";
import { isSiteRouteActive, mobileNavigation, type SiteRouteId } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

type MobileHeaderMenuProps = {
  currentPath: string;
};

type MenuState = "closed" | "open" | "closing";

const MENU_CLOSE_FALLBACK_MS = 150;
const menuItem =
  "flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-left text-sm text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 aria-[current=page]:bg-ink-50 aria-[current=page]:text-ink-800";
const routeIcons: Record<SiteRouteId, typeof FileTextIcon> = {
  home: FileTextIcon,
  projects: RocketIcon,
  photos: ImagesIcon,
  tags: TagsIcon,
  about: UserIcon,
  feed: RssIcon,
};
const routes = mobileNavigation();

export function MobileHeaderMenu({ currentPath }: MobileHeaderMenuProps) {
  const [menuState, setMenuState] = useState<MenuState>("closed");
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const open = menuState === "open";

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setMenuState("open");
  }, [clearCloseTimer]);

  const closeMenu = useCallback(
    (restoreFocus = false) => {
      clearCloseTimer();
      setMenuState("closing");
      const duration =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--duration-quick"),
        ) || MENU_CLOSE_FALLBACK_MS;

      closeTimerRef.current = window.setTimeout(() => {
        setMenuState("closed");
        closeTimerRef.current = null;
      }, duration);

      if (restoreFocus) {
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    },
    [clearCloseTimer],
  );

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    if (open) {
      firstItemRef.current?.focus();
    }
  }, [open]);

  const toggleTheme = () => {
    closeMenu();
    window.dispatchEvent(new Event(THEME_TOGGLE_EVENT));
  };

  return (
    <div ref={menuRef} className="relative shrink-0 lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? "关闭导航" : "打开导航"}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? closeMenu() : openMenu())}
        className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-line bg-surface text-ink-600 transition-[transform,background-color] hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.96]"
      >
        <MenuIcon aria-hidden="true" className="h-4 w-4" />
      </button>

      <div
        id={menuId}
        data-origin="top-right"
        data-state={menuState}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "t-dropdown absolute right-0 top-11 z-30 w-56 rounded-[10px] border border-line bg-surface p-2 shadow-[0_22px_60px_-36px_rgba(0,0,0,0.5)]",
          menuState === "open" && "is-open",
          menuState === "closing" && "is-closing",
          menuState === "closed" && "invisible",
        )}
      >
        <nav aria-label="移动端导航" className="space-y-1">
          {routes.map((route, index) => {
            const Icon = routeIcons[route.id];
            const active = isSiteRouteActive(currentPath, route.path);
            return (
              <a
                key={route.path}
                ref={index === 0 ? firstItemRef : undefined}
                href={route.href}
                data-astro-reload={route.reload ? "" : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => closeMenu()}
                className={menuItem}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {route.label}
              </a>
            );
          })}
          <div className="my-1 h-px bg-line" />
          <button type="button" onClick={toggleTheme} className={menuItem}>
            <MoonStarIcon aria-hidden="true" className="h-4 w-4" />
            翻转世界
            <span className="ml-auto font-mono text-[10px] text-ink-400">⌘J</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
