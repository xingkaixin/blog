import { MagnifyingGlassIcon, ReaderIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { SearchDialog } from "@/components/search-dialog";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export function SiteLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="relative min-h-screen">
      <div className="grain-overlay" />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink-800 focus:px-4 focus:py-2 focus:text-paper"
      >
        跳到正文
      </a>
      <header className="sticky top-0 z-20 border-b border-[#d8d0c4] bg-[#f7f3eb]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <Link to="/" className="group inline-flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden">
              <img
                src="/logo.svg"
                alt="行开心的颠倒世界 logo"
                width={200}
                height={200}
                className="h-10 w-10 object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-medium tracking-tight text-ink-800">{siteConfig.title}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {!isHome && (
              <Link to="/" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  <ReaderIcon aria-hidden="true" className="h-4 w-4" />
                  返回文章列表
                </Button>
              </Link>
            )}
            <SearchDialog
              trigger={
                <Button variant="secondary" size="sm">
                  <MagnifyingGlassIcon aria-hidden="true" className="h-4 w-4" />
                  搜索文章
                  <span className="hidden rounded-full bg-ink-800/5 px-2 py-0.5 font-mono text-[0.7rem] text-ink-500 sm:inline-flex">
                    /
                  </span>
                </Button>
              }
            />
          </div>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <footer className="border-t border-[#d8d0c4] px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            人生不该只有一种体验，不应该每个人的生活都像钉子一样专注。做个兴趣广泛、体验丰富的人，同样幸福
          </p>
          <p className="font-mono text-xs uppercase tracking-[0.24em]">
            &copy; {new Date().getFullYear()} XingKaiXin
          </p>
        </div>
      </footer>
    </div>
  );
}
