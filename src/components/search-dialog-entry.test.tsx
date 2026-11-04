// @vitest-environment happy-dom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSearchCache } from "@/lib/search";
// Preloaded so the shortcut's dynamic import settles inside act().
import "@/lib/search-launcher";
import { installSiteShortcuts } from "@/lib/site-shortcuts";
import { openSearchDialog } from "./search-dialog-entry";

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetSearchCache();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]"));
  await import("./search-panel");
});

afterEach(async () => {
  await act(async () => document.dispatchEvent(new Event("astro:before-swap")));
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("search dialog entry", () => {
  it("boots the search dialog from the first keyboard shortcut", async () => {
    const container = document.createElement("div");
    container.dataset.searchRoot = "";
    document.body.append(container);
    const uninstall = installSiteShortcuts(window);
    try {
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      });
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    } finally {
      uninstall();
    }
  });
  it.each(["isComposing", "keyCode"])(
    "leaves composition keys to the input method when marked by %s",
    async (marker) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify([
            { slug: "first", title: "测试文章一", date: "2026-08-27", summary: "第一篇", tags: [] },
            {
              slug: "second",
              title: "测试文章二",
              date: "2026-08-26",
              summary: "第二篇",
              tags: [],
            },
          ]),
        ),
      );
      const container = document.createElement("div");
      document.body.append(container);
      await act(async () => openSearchDialog(container));
      const input = document.querySelector<HTMLInputElement>('input[aria-label="搜索与命令"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          input,
          "测试",
        );
        input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
      });
      const click = vi.fn((event: MouseEvent) => event.preventDefault());
      const results = document.querySelector<HTMLElement>("#command-palette-results")!;
      results.addEventListener("click", click);
      const initialSelection = input.getAttribute("aria-activedescendant");
      const keys = ["ArrowDown", "ArrowUp", "Enter"].map(
        (key) =>
          new KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
            ...(marker === "isComposing" ? { isComposing: true } : { keyCode: 229 }),
          }),
      );
      for (const event of keys) {
        await act(async () => input.dispatchEvent(event));
      }
      expect(keys.every((event) => !event.defaultPrevented)).toBe(true);
      expect(input.getAttribute("aria-activedescendant")).toBe(initialSelection);
      expect(click).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();

      await act(async () =>
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(input.getAttribute("aria-activedescendant")).toBe("post-second");
      await act(async () =>
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(click).toHaveBeenCalledTimes(1);
      expect(
        (click.mock.calls[0][0].target as HTMLElement).closest("a")?.getAttribute("href"),
      ).toBe("/posts/second/");
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    },
  );
});
