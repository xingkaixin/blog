// @vitest-environment happy-dom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetModules();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  document.body.innerHTML =
    '<div data-search-root><div data-search-error role="alert" hidden>搜索暂时无法加载</div></div>';
});

afterEach(async () => {
  await act(async () => document.dispatchEvent(new Event("astro:before-swap")));
  document.body.replaceChildren();
  vi.doUnmock("@/components/search-dialog-entry");
  vi.doUnmock("@/components/search-panel");
  vi.restoreAllMocks();
});

describe("search launcher recovery", () => {
  it("reports a failed script load and can open after a retry", async () => {
    vi.doMock("@/components/search-dialog-entry", () => {
      throw new Error("simulated script download failure");
    });
    const { openSearch } = await import("./search-launcher");
    const error = document.querySelector<HTMLElement>("[data-search-error]")!;
    await act(async () => {
      await expect(openSearch()).resolves.toBeUndefined();
    });
    expect(error.hidden).toBe(false);

    vi.doUnmock("@/components/search-dialog-entry");
    await act(async () => openSearch());
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector("[data-search-error]")).toBeNull();
  });

  it("keeps dependency failures visible when the module error is cached", async () => {
    vi.doMock("@/components/search-panel", () => {
      throw new Error("simulated dependency load failure");
    });
    const { openSearch } = await import("./search-launcher");
    const error = document.querySelector<HTMLElement>("[data-search-error]")!;
    for (let attempt = 0; attempt < 2; attempt++) {
      await act(async () => {
        await expect(openSearch()).resolves.toBeUndefined();
      });
      expect(error.hidden).toBe(false);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    }
  });

  it("opens only one dialog for concurrent requests", async () => {
    const pending = Promise.withResolvers<void>();
    vi.doMock("@/components/search-dialog-entry", async (importOriginal) => {
      await pending.promise;
      return importOriginal();
    });
    const { openSearch } = await import("./search-launcher");
    await act(async () => {
      const requests = [openSearch(), openSearch()];
      pending.resolve();
      await Promise.all(requests);
    });
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it("does not show late failures on a page that is being replaced", async () => {
    const pending = Promise.withResolvers<never>();
    vi.doMock("@/components/search-dialog-entry", () => pending.promise);
    const { openSearch } = await import("./search-launcher");
    const error = document.querySelector<HTMLElement>("[data-search-error]")!;
    const opening = openSearch();
    document.dispatchEvent(new Event("astro:before-swap"));
    pending.reject(new Error("simulated late script failure"));
    await expect(opening).resolves.toBeUndefined();
    expect(error.hidden).toBe(true);
  });
});
