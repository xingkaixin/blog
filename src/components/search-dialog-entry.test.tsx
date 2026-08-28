// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSearchCache } from "@/lib/search";
import { openSearch } from "@/lib/search-launcher";
import { PhotoLightbox } from "./photo-lightbox";
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
  it("keeps keyboard selection when scrolling moves results under a stationary pointer", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    await act(async () => openSearchDialog(container));
    const input = document.querySelector<HTMLInputElement>('input[aria-label="搜索与命令"]')!;
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })),
    );
    const active = input.getAttribute("aria-activedescendant");
    await act(async () => options[1].dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(input.getAttribute("aria-activedescendant")).toBe(active);
    await act(async () =>
      options[1].dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "touch" }),
      ),
    );
    expect(input.getAttribute("aria-activedescendant")).toBe(active);
    await act(async () =>
      options[1].dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }),
      ),
    );
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
  });

  it("keeps the highlighted option consistent while filtering a longer result list", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    await act(async () => openSearchDialog(container));
    const input = document.querySelector<HTMLInputElement>('input[aria-label="搜索与命令"]')!;
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })),
    );
    const highlights: (string | null)[] = [];
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
      function (this: HTMLElement) {
        highlights.push(this.getAttribute("aria-selected"));
      },
    );
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "主题",
      );
      input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    });
    expect(highlights).not.toHaveLength(0);
    expect(highlights.every((value) => value === "true")).toBe(true);
  });
  it.each(["before", "after"])("ignores opens started %s a page swap begins", async (timing) => {
    const container = document.createElement("div");
    container.dataset.searchRoot = "";
    document.body.append(container);
    await act(async () => {
      const pending = timing === "before" ? openSearch() : null;
      document.dispatchEvent(new Event("astro:before-swap"));
      await (pending ?? openSearch());
    });
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it("ignores late open requests from a replaced page", async () => {
    const oldContainer = document.createElement("div");
    document.body.append(oldContainer);
    document.dispatchEvent(new Event("astro:before-swap"));
    const currentContainer = document.createElement("div");
    oldContainer.replaceWith(currentContainer);

    await act(async () => {
      openSearchDialog(oldContainer);
      openSearchDialog(currentContainer);
    });

    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
  });

  it("reuses the current root and unmounts it before replacing the page", async () => {
    const container = document.createElement("div");
    container.dataset.searchRoot = "";
    document.body.append(container);
    await act(async () => openSearch());
    await act(async () => openSearch());
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);

    await act(async () => document.dispatchEvent(new Event("astro:before-swap")));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    const nextContainer = document.createElement("div");
    nextContainer.dataset.searchRoot = "";
    container.replaceWith(nextContainer);
    await act(async () => openSearch());
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it("keeps search arrow keys from navigating the photo underneath", async () => {
    const photo = {
      id: "a".repeat(32),
      capturedAt: "2026-08-27T12:00:00+08:00",
      width: 1200,
      height: 800,
      albumIds: [],
      placeholderColor: "#112233",
    };
    const previous = { ...photo, id: "b".repeat(32) };
    const next = { ...photo, id: "c".repeat(32) };
    const onSelect = vi.fn();
    const photoContainer = document.createElement("div");
    const searchContainer = document.createElement("div");
    document.body.append(photoContainer, searchContainer);
    const root = createRoot(photoContainer);
    try {
      await act(async () =>
        root.render(
          <PhotoLightbox
            baseUrl="https://photos.example.com"
            open
            photo={photo}
            navigation={{ previous, next, position: 2, total: 3, status: "ready" }}
            albums={[]}
            onClose={vi.fn()}
            onSelect={onSelect}
            onRetryNavigation={vi.fn()}
          />,
        ),
      );
      const close = document.querySelector<HTMLButtonElement>('button[aria-label="关闭大图"]')!;
      await act(async () => close.focus());
      for (const key of ["ArrowLeft", "ArrowRight"]) {
        await act(async () =>
          close.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })),
        );
      }
      expect(onSelect.mock.calls.map(([selected]) => selected)).toEqual([previous, next]);
      onSelect.mockClear();

      await act(async () => openSearchDialog(searchContainer));
      const input = document.querySelector<HTMLInputElement>('input[aria-label="搜索与命令"]')!;
      const keys = ["ArrowLeft", "ArrowRight"].map(
        (key) => new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
      for (const event of keys) {
        await act(async () => input.dispatchEvent(event));
      }
      expect(onSelect).not.toHaveBeenCalled();
      expect(keys.every((event) => !event.defaultPrevented)).toBe(true);
      expect(document.activeElement).toBe(input);
      await act(async () =>
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
      );
      expect(document.activeElement).toBe(close);
      await act(async () =>
        document.activeElement!.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        ),
      );
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(next);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("reveals keyboard selections without moving focus out of the search input", async () => {
    const revealed: HTMLElement[] = [];
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
      function (this: HTMLElement) {
        revealed.push(this);
      },
    );
    const container = document.createElement("div");
    document.body.append(container);
    await act(async () => openSearchDialog(container));
    const input = document.querySelector<HTMLInputElement>('input[aria-label="搜索与命令"]')!;
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    const selections = [
      { key: "ArrowUp", item: options.at(-1)! },
      { key: "ArrowDown", item: options[0] },
      { key: "ArrowDown", item: options[1] },
    ];
    for (const { key, item } of selections) {
      revealed.length = 0;
      await act(async () =>
        input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })),
      );
      expect(input.getAttribute("aria-activedescendant")).toBe(item.id);
      expect(revealed).toEqual([item]);
      expect(document.activeElement).toBe(input);
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
