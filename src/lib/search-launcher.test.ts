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
  vi.restoreAllMocks();
});

describe("search launcher recovery", () => {
  it("reports a failed script load and can open after a retry", async () => {
    let downloadFails = true;
    vi.doMock("@/components/search-dialog-entry", async (importOriginal) => {
      if (downloadFails) {
        throw new Error("simulated script download failure");
      }
      return importOriginal();
    });
    const { openSearch } = await import("./search-launcher");
    const error = document.querySelector<HTMLElement>("[data-search-error]")!;
    await act(async () => {
      await expect(openSearch()).resolves.toBeUndefined();
    });
    expect(error.hidden).toBe(false);

    downloadFails = false;
    await act(async () => openSearch());
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector("[data-search-error]")).toBeNull();
  });
});
