// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachSmartHeader } from "./smart-header";

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    writable: true,
    value,
  });
}

function flushScroll(value: number) {
  setScrollY(value);
  window.dispatchEvent(new Event("scroll"));
}

describe("attachSmartHeader", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    setScrollY(0);
    vi.restoreAllMocks();
  });

  it("keeps non-compact pages pinned regardless of downward scroll", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    document.body.innerHTML = `
      <header data-smart-header>
        <div class="header-bar-main"><a href="/">Home</a></div>
      </header>
    `;
    const header = document.querySelector<HTMLElement>("[data-smart-header]")!;
    const controller = attachSmartHeader({ header, threshold: 200 });

    expect(header.dataset.headerState).toBe("pinned");
    flushScroll(400);
    expect(header.dataset.headerState).toBe("pinned");

    controller.destroy();
    expect(header.dataset.headerState).toBeUndefined();
  });

  it("switches to compact on article scroll down and restores pinned on up >8px, focus, or menu open", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    document.body.innerHTML = `
      <header data-smart-header data-has-compact-bar>
        <div class="header-bar-main">
          <a href="/posts/" id="nav-posts">Posts</a>
          <div class="t-dropdown"></div>
        </div>
        <div class="header-bar-compact"></div>
      </header>
      <div data-post-header></div>
    `;
    const header = document.querySelector<HTMLElement>("[data-smart-header]")!;
    const navLink = document.querySelector<HTMLAnchorElement>("#nav-posts")!;
    const dropdown = header.querySelector<HTMLElement>(".t-dropdown")!;

    const controller = attachSmartHeader({ header, threshold: 200 });
    expect(header.dataset.headerState).toBe("pinned");

    flushScroll(300);
    expect(header.dataset.headerState).toBe("compact");

    // Micro upward scroll within 8px tolerance stays compact.
    flushScroll(295);
    expect(header.dataset.headerState).toBe("compact");

    // Upward scroll beyond 8px restores pinned.
    flushScroll(280);
    expect(header.dataset.headerState).toBe("pinned");

    flushScroll(360);
    expect(header.dataset.headerState).toBe("compact");

    // Focusing main bar restores pinned immediately.
    navLink.focus();
    expect(header.dataset.headerState).toBe("pinned");
    navLink.blur();

    flushScroll(420);
    expect(header.dataset.headerState).toBe("compact");

    // Open mobile dropdown keeps header pinned on scroll updates.
    dropdown.classList.add("is-open");
    flushScroll(460);
    expect(header.dataset.headerState).toBe("pinned");

    dropdown.classList.remove("is-open");
    flushScroll(500);
    expect(header.dataset.headerState).toBe("compact");

    // Scrolling back above threshold restores pinned.
    flushScroll(150);
    expect(header.dataset.headerState).toBe("pinned");

    controller.destroy();
    expect(header.dataset.headerState).toBeUndefined();
  });
});
