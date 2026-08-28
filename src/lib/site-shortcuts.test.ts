// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openSearch } from "./search-launcher";
import { THEME_TOGGLE_EVENT } from "./site-events";
import { installSiteShortcuts } from "./site-shortcuts";

vi.mock("./search-launcher", () => ({ openSearch: vi.fn().mockResolvedValue(undefined) }));

let uninstall: () => void;

beforeEach(() => {
  uninstall = installSiteShortcuts(window);
});
afterEach(() => {
  uninstall();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe("site shortcuts", () => {
  it.each([{ key: "k", metaKey: true }, { key: "K", ctrlKey: true }, { key: "/" }])(
    "opens search using %j",
    async (init) => {
      const event = new KeyboardEvent("keydown", { ...init, cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(openSearch).toHaveBeenCalledOnce());
    },
  );

  it("toggles the theme once and removes its listener on cleanup", () => {
    const toggle = vi.fn();
    window.addEventListener(THEME_TOGGLE_EVENT, toggle);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true }));
    uninstall();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", ctrlKey: true }));
    expect(toggle).toHaveBeenCalledOnce();
    window.removeEventListener(THEME_TOGGLE_EVENT, toggle);
  });

  it.each(["input", "textarea", "select", "div"])("does not intercept typing in %s", (tag) => {
    const element = document.createElement(tag);
    element.contentEditable = "true";
    document.body.append(element);
    const event = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([{ isComposing: true }, { repeat: true }, { altKey: true }])(
    "ignores unavailable key events %j",
    (init) => {
      const event = new KeyboardEvent("keydown", { key: "/", cancelable: true, ...init });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it("respects a child handler that already consumed the key", async () => {
    const event = new KeyboardEvent("keydown", { key: "/", cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    await Promise.resolve();
    expect(openSearch).not.toHaveBeenCalled();
  });
});
