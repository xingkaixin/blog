import { installAnalytics } from "@/lib/analytics";
import { observeArticleEngagement } from "@/lib/article-engagement";
import {
  ARTICLE_FOOTER_REVEAL_THRESHOLD,
  shouldTriggerArticleFooterReveal,
} from "@/lib/article-footer-trigger";
import { dayPartAt, nextDayPartDelayMs } from "@/lib/day-part";
import type { FooterScene } from "@/lib/footer-scene";
import { refreshHolidayLogo, refreshSiteBrandDayPart } from "@/lib/holiday-logo-browser";
import { holidayDateAt } from "@/lib/holiday-logo-lookup";
import { LOCALE_COOKIE } from "@/lib/i18n";
import type { PondHandle } from "@/lib/koi-pond/pond";
import { installPostTransitions } from "@/lib/post-transition";
import { openSearch } from "@/lib/search-launcher";
import { THEME_TOGGLE_EVENT } from "@/lib/site-events";
import { installSiteShortcuts } from "@/lib/site-shortcuts";
import { skipToContent } from "@/lib/skip-to-content";
import { attachSmartHeader, type SmartHeaderController } from "@/lib/smart-header";
import {
  collectStamp,
  OPEN_STAMPS_EVENT,
  readStamps,
  STAMP_COLLECTED_EVENT,
  stamps,
  type StampId,
} from "@/lib/stamps";

const STAMP_TOAST_MS = 3600;
const SCREENSAVER_IDLE_MS = 2 * 60 * 1000;

class MobileHeaderMenu extends HTMLElement {
  private controller: AbortController | null = null;
  private isOpen = false;

  connectedCallback() {
    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    const trigger = this.querySelector<HTMLButtonElement>("[data-mobile-menu-trigger]");
    const panel = this.querySelector<HTMLElement>("[data-mobile-menu-panel]");
    const firstItem = this.querySelector<HTMLElement>("[data-mobile-menu-first]");
    if (!trigger || !panel) {
      return;
    }

    const openLabel = this.dataset.openLabel ?? "打开导航";
    const closeLabel = this.dataset.closeLabel ?? "关闭导航";

    const setOpen = (next: boolean, restoreFocus = true) => {
      if (this.isOpen === next) {
        return;
      }
      this.isOpen = next;
      trigger.setAttribute("aria-expanded", String(next));
      trigger.setAttribute("aria-label", next ? closeLabel : openLabel);
      panel.setAttribute("aria-hidden", String(!next));
      panel.inert = !next;
      panel.classList.toggle("is-open", next);

      if (next) {
        firstItem?.focus({ preventScroll: true });
      } else if (restoreFocus && this.contains(document.activeElement)) {
        trigger.focus({ preventScroll: true });
      }
    };

    trigger.addEventListener("click", () => setOpen(!this.isOpen), { signal });

    panel.addEventListener(
      "click",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
          return;
        }
        if (target.closest("[data-mobile-menu-theme]")) {
          setOpen(false);
          window.dispatchEvent(new Event(THEME_TOGGLE_EVENT));
          return;
        }
        if (target.closest("[data-mobile-menu-stamps]")) {
          setOpen(false, false);
          window.dispatchEvent(new Event(OPEN_STAMPS_EVENT));
          return;
        }
        if (target.closest("a")) {
          setOpen(false, false);
        }
      },
      { signal },
    );

    document.addEventListener(
      "pointerdown",
      (event) => {
        if (this.isOpen && !this.contains(event.target as Node)) {
          setOpen(false, false);
        }
      },
      { signal },
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (this.isOpen && event.key === "Escape") {
          setOpen(false);
        }
      },
      { signal },
    );
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.isOpen = false;
  }
}

class StampBook extends HTMLElement {
  private controller: AbortController | null = null;
  private stopReading: (() => void) | undefined;
  private timer = 0;

  connectedCallback() {
    const dialog = this.querySelector<HTMLDialogElement>("[data-stamp-dialog]");
    const toast = this.querySelector<HTMLElement>("[data-stamp-toast]");
    const toastSeal = this.querySelector<HTMLElement>("[data-stamp-toast-seal]");
    const toastName = this.querySelector<HTMLElement>("[data-stamp-toast-name]");
    if (!dialog || !toast || !toastSeal || !toastName) {
      return;
    }

    this.controller = new AbortController();
    const { signal } = this.controller;

    const render = () => {
      const collected = readStamps();
      for (const item of this.querySelectorAll<HTMLElement>("[data-stamp]")) {
        const date = collected[item.dataset.stamp as StampId];
        const hint = item.querySelector<HTMLElement>("[data-stamp-hint]");
        item.toggleAttribute("data-collected", Boolean(date));
        if (hint) {
          hint.textContent = date ?? hint.dataset.stampHint ?? "";
        }
      }
      const count = String(stamps.filter((stamp) => collected[stamp.id]).length);
      for (const target of document.querySelectorAll("[data-stamp-count]")) {
        target.textContent = count;
      }
    };

    const queue: string[] = [];
    let toastActive = false;
    let toastCloseTimer = 0;
    let toastCloseToken = 0;
    let dialogCloseTimer = 0;
    let dialogCloseToken = 0;
    let returnFocusTo: HTMLElement | null = null;

    const prefersReducedMotion = () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clearToastClose = () => {
      toastCloseToken += 1;
      clearTimeout(toastCloseTimer);
      toastCloseTimer = 0;
      delete toast.dataset.closing;
    };

    const hideToast = (onHidden: () => void) => {
      clearToastClose();
      if (toast.hidden || prefersReducedMotion()) {
        toast.hidden = true;
        onHidden();
        return;
      }
      const token = toastCloseToken;
      toast.dataset.closing = "";
      const finish = () => {
        if (token !== toastCloseToken || signal.aborted) {
          return;
        }
        delete toast.dataset.closing;
        toast.hidden = true;
        onHidden();
      };
      toast.addEventListener(
        "transitionend",
        (event) => {
          if (event.target === toast) {
            clearTimeout(toastCloseTimer);
            toastCloseTimer = 0;
            finish();
          }
        },
        { once: true, signal },
      );
      toastCloseTimer = window.setTimeout(finish, 200);
    };

    const showNext = () => {
      clearToastClose();
      const seal = queue.shift();
      if (!seal) {
        toastActive = false;
        toast.hidden = true;
        return;
      }
      toastActive = true;
      toastSeal.textContent = seal;
      toastName.textContent = seal;
      toast.hidden = false;
      void toast.offsetWidth;
      this.timer = window.setTimeout(() => {
        hideToast(() => {
          if (queue.length > 0) {
            showNext();
          } else {
            toastActive = false;
          }
        });
      }, STAMP_TOAST_MS);
    };

    const restoreFocus = () => {
      const target = returnFocusTo;
      returnFocusTo = null;
      if (target && target.isConnected && target.getClientRects().length > 0) {
        target.focus({ preventScroll: true });
      }
    };

    const clearDialogClose = () => {
      dialogCloseToken += 1;
      clearTimeout(dialogCloseTimer);
      dialogCloseTimer = 0;
      delete dialog.dataset.closing;
    };

    const openDialog = () => {
      clearDialogClose();
      const active = document.activeElement;
      if (active instanceof HTMLElement && !dialog.contains(active)) {
        returnFocusTo = active;
      }
      if (!dialog.open) {
        dialog.showModal();
      }
    };

    const closeDialog = () => {
      if (!dialog.open) {
        clearDialogClose();
        return;
      }
      if (prefersReducedMotion()) {
        clearDialogClose();
        dialog.close();
        restoreFocus();
        return;
      }
      if (dialog.hasAttribute("data-closing")) {
        return;
      }
      clearDialogClose();
      const token = dialogCloseToken;
      dialog.dataset.closing = "";
      const finish = () => {
        if (token !== dialogCloseToken || signal.aborted) {
          return;
        }
        delete dialog.dataset.closing;
        if (dialog.open) {
          dialog.close();
        }
        restoreFocus();
      };
      dialog.addEventListener(
        "transitionend",
        (event) => {
          if (event.target === dialog) {
            clearTimeout(dialogCloseTimer);
            dialogCloseTimer = 0;
            finish();
          }
        },
        { once: true, signal },
      );
      dialogCloseTimer = window.setTimeout(finish, 200);
    };

    signal.addEventListener(
      "abort",
      () => {
        clearToastClose();
        clearDialogClose();
      },
      { once: true },
    );

    window.addEventListener(
      STAMP_COLLECTED_EVENT,
      (event) => {
        render();
        const id = (event as CustomEvent<StampId>).detail;
        queue.push(stamps.find((stamp) => stamp.id === id)!.seal);
        if (!toastActive) {
          showNext();
        }
      },
      { signal },
    );
    window.addEventListener("storage", render, { signal });
    window.addEventListener(THEME_TOGGLE_EVENT, () => collectStamp("flip"), { signal });
    window.addEventListener(OPEN_STAMPS_EVENT, openDialog, { signal });
    document.addEventListener(
      "click",
      (event) => {
        if (event.target instanceof Element && event.target.closest("[data-open-stamps]")) {
          openDialog();
        }
      },
      { signal },
    );
    dialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        closeDialog();
      },
      { signal },
    );
    dialog.addEventListener(
      "close",
      () => {
        clearDialogClose();
        restoreFocus();
      },
      { signal },
    );
    dialog.addEventListener(
      "click",
      (event) => {
        const target = event.target as Element;
        if (target === dialog || target.closest("[data-stamp-close]")) {
          closeDialog();
        }
      },
      { signal },
    );

    render();
    collectStamp("arrival");
    if (dayPartAt(new Date()) === "night") {
      collectStamp("night");
    }
    if (document.documentElement.hasAttribute("data-darkroom")) {
      collectStamp("darkroom");
    }
    if (document.querySelector("[data-flip-back]")) {
      collectStamp("lost");
    }
    const article = document.querySelector<HTMLElement>(".article-prose");
    if (article && !readStamps().reader) {
      this.stopReading = observeArticleEngagement(article, () => collectStamp("reader"));
    }
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = null;
    this.stopReading?.();
    this.stopReading = undefined;
    clearTimeout(this.timer);
  }
}

function installBrandScheduler() {
  let midnightTimer: ReturnType<typeof setTimeout>;
  let dayPartTimer: ReturnType<typeof setTimeout>;

  function scheduleDayPart() {
    clearTimeout(dayPartTimer);
    const now = new Date();
    refreshSiteBrandDayPart(now);
    dayPartTimer = setTimeout(scheduleDayPart, nextDayPartDelayMs(now));
  }

  function updateHolidayLogo() {
    clearTimeout(midnightTimer);
    refreshHolidayLogo();
    scheduleDayPart();
    const now = new Date();
    const nextMidnight = Date.parse(`${holidayDateAt(now)}T00:00:00+08:00`) + 86_400_000;
    midnightTimer = setTimeout(updateHolidayLogo, nextMidnight - now.getTime());
  }

  updateHolidayLogo();
  document.addEventListener("astro:page-load", updateHolidayLogo);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateHolidayLogo();
    }
  });

  function refreshDayPart(event: Event) {
    const brand =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-site-brand]")
        : null;
    if (brand) {
      refreshSiteBrandDayPart();
    }
  }

  document.addEventListener("pointerover", refreshDayPart);
  document.addEventListener("focusin", refreshDayPart);
}

function installSceneFooter() {
  let cleanup: (() => void) | null = null;
  let generation = 0;

  function teardown() {
    generation++;
    cleanup?.();
    cleanup = null;
  }

  document.addEventListener("astro:page-load", () => {
    teardown();
    const canvas = document.querySelector<HTMLCanvasElement>(".footer-art");
    const footer = canvas?.closest<HTMLElement>(".scene-footer");
    if (!canvas || !footer) {
      return;
    }
    const mounting = generation;

    if (footer.dataset.footerArtwork === "ink-wash") {
      let handle: {
        triggerReveal(): void;
        setVisible(on: boolean): void;
        destroy(): void;
      } | null = null;
      let visible = false;
      let revealed = false;
      let loading = false;

      const checkReveal = () => {
        if (revealed) {
          return;
        }
        const rect = footer.getBoundingClientRect();
        if (
          shouldTriggerArticleFooterReveal({
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            viewportHeight: window.innerHeight,
            scrollY: window.scrollY,
            scrollHeight: document.documentElement.scrollHeight,
          })
        ) {
          revealed = true;
          handle?.triggerReveal();
        }
      };

      const ensureLoaded = () => {
        if (handle || loading) {
          return;
        }
        loading = true;
        void import("@/lib/article-footer-scene").then(({ mountArticleFooterScene }) => {
          if (mounting !== generation) {
            return;
          }
          const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
          handle = mountArticleFooterScene(canvas, animate);
          handle.setVisible(visible);
          if (revealed) {
            handle.triggerReveal();
          } else {
            checkReveal();
          }
        });
      };

      // 提前 200px 预加载 WebGL 与压缩纹理，保证滑过 50% 时零等待起播
      const preloadObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            ensureLoaded();
            preloadObserver.disconnect();
          }
        },
        { rootMargin: "200px 0px" },
      );

      const revealObserver = new IntersectionObserver(
        ([entry]) => {
          visible = entry?.isIntersecting ?? false;
          handle?.setVisible(visible);
          if (visible) {
            ensureLoaded();
            if ((entry?.intersectionRatio ?? 0) >= ARTICLE_FOOTER_REVEAL_THRESHOLD) {
              revealed = true;
              handle?.triggerReveal();
            } else {
              checkReveal();
            }
          }
        },
        { threshold: [0, 0.25, ARTICLE_FOOTER_REVEAL_THRESHOLD, 0.75, 1] },
      );

      const events = new AbortController();
      window.addEventListener("scroll", checkReveal, { passive: true, signal: events.signal });
      window.addEventListener("resize", checkReveal, { passive: true, signal: events.signal });

      preloadObserver.observe(footer);
      revealObserver.observe(footer);

      cleanup = () => {
        events.abort();
        preloadObserver.disconnect();
        revealObserver.disconnect();
        handle?.destroy();
        handle = null;
      };
      return;
    }

    const scene = footer.dataset.scene as FooterScene;
    let handle: { setActive(on: boolean): void; destroy(): void } | null = null;
    let visible = false;
    let loading = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        handle?.setActive(visible);
        if (!visible || handle || loading) {
          return;
        }
        loading = true;
        void import("@/lib/footer-scene").then(({ mountFooterScene }) => {
          if (mounting !== generation) {
            return;
          }
          const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
          handle = mountFooterScene(canvas, scene, animate);
          handle.setActive(visible);
        });
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(footer);
    cleanup = () => {
      observer.disconnect();
      handle?.destroy();
      handle = null;
    };
  });
  document.addEventListener("astro:before-swap", teardown);
}

function installScreensaver() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return;
  }

  let timer = 0;
  let root: HTMLElement | null = null;
  let pond: PondHandle | null = null;
  let generation = 0;

  function isBusy(): boolean {
    return (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.querySelector('[role="dialog"]') !== null ||
      [...document.querySelectorAll("audio")].some((audio) => !audio.paused) ||
      document.activeElement?.matches("input, textarea, select, [contenteditable]") === true ||
      document.getSelection()?.isCollapsed === false
    );
  }

  function arm() {
    clearTimeout(timer);
    if (!root && document.visibilityState === "visible") {
      timer = window.setTimeout(() => void show(), SCREENSAVER_IDLE_MS);
    }
  }

  async function show() {
    const template = document.querySelector<HTMLTemplateElement>("template[data-screensaver]");
    if (!template || isBusy()) {
      arm();
      return;
    }

    const mine = ++generation;
    const { createPond } = await import("@/lib/koi-pond/pond");
    if (mine !== generation) {
      return;
    }

    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const element = fragment.querySelector<HTMLElement>(".screensaver");
    const water = fragment.querySelector<HTMLCanvasElement>(".screensaver-water");
    const overlay = fragment.querySelector<HTMLCanvasElement>(".screensaver-overlay");
    if (!element || !water || !overlay) {
      return;
    }

    document.body.append(element);
    const result = createPond(water, {
      animated: true,
      overlay,
      onFishingChange: () => {},
      onContextRestored: hide,
    });
    if (!result.ok) {
      element.remove();
      return;
    }
    root = element;
    pond = result.pond;
  }

  function hide() {
    generation++;
    if (!root) {
      return;
    }
    const element = root;
    const leaving = pond;
    root = null;
    pond = null;
    element.dataset.leaving = "";
    void Promise.allSettled(element.getAnimations().map((animation) => animation.finished)).then(
      () => {
        leaving?.destroy(true);
        element.remove();
      },
    );
  }

  function wake() {
    hide();
    arm();
  }

  function onPointerMove(event: PointerEvent) {
    if (event.movementX !== 0 || event.movementY !== 0) {
      wake();
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (root) {
      event.preventDefault();
      event.stopPropagation();
    }
    wake();
  }

  const passive = { capture: true, passive: true };
  window.addEventListener("pointermove", onPointerMove, passive);
  window.addEventListener("pointerdown", wake, passive);
  window.addEventListener("wheel", wake, passive);
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("keydown", onKeyDown, { capture: true });
  document.addEventListener("visibilitychange", arm);
  arm();
}

let installed = false;

export function installSiteShell(): void {
  if (installed) {
    return;
  }
  installed = true;

  if (!customElements.get("mobile-header-menu")) {
    customElements.define("mobile-header-menu", MobileHeaderMenu);
  }
  if (!customElements.get("stamp-book")) {
    customElements.define("stamp-book", StampBook);
  }

  document.addEventListener("click", skipToContent, true);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const langLink = target.closest<HTMLElement>("[data-language-switch]");
    if (langLink) {
      document.cookie = `${LOCALE_COOKIE}=${langLink.dataset.languageSwitch}; path=/; max-age=31536000; samesite=lax`;
      return;
    }
    const searchButton = target.closest<HTMLElement>("[data-search-trigger]");
    if (searchButton) {
      void openSearch({ source: "pointer", triggerElement: searchButton });
      return;
    }
    if (target.closest("[data-search-reload]")) {
      window.location.reload();
      return;
    }
    const tocButton = target.closest<HTMLButtonElement>("[data-compact-toc]");
    if (tocButton && document.querySelector("[data-post-toc]")) {
      document.dispatchEvent(new CustomEvent("site:open-toc"));
    }
  });

  // WebMCP 仅在支持 modelContext 的浏览器/Agent 中按需加载，避免全站首屏拉取项目与搜索模块。
  if (
    "modelContext" in document &&
    (document as Document & { modelContext?: unknown }).modelContext
  ) {
    void import("@/lib/webmcp")
      .then(({ registerBlogWebMcpTools }) => registerBlogWebMcpTools(document))
      .catch((error) => {
        console.error("Failed to register WebMCP tools", error);
      });
  }

  installPostTransitions();
  installSiteShortcuts(window);
  installBrandScheduler();
  installSceneFooter();
  installScreensaver();
  installAnalytics();

  let headerController: SmartHeaderController | null = null;

  function setupSmartHeader() {
    headerController?.destroy();
    headerController = null;

    const header = document.querySelector<HTMLElement>("header[data-smart-header]");
    if (!header) {
      return;
    }

    const thresholdTarget = document.querySelector<HTMLElement>("[data-post-header]");
    headerController = attachSmartHeader({
      header,
      thresholdTarget,
      isLocked: () =>
        document.documentElement.hasAttribute("data-agent-view") ||
        Boolean(header.querySelector('.t-dropdown.is-open, button[aria-expanded="true"]')),
    });
  }

  document.addEventListener("astro:page-load", setupSmartHeader);
  document.addEventListener("astro:before-swap", () => {
    headerController?.destroy();
    headerController = null;
  });
}
