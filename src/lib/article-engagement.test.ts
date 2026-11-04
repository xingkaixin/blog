// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeArticleEngagement } from "./article-engagement";

let body: HTMLElement;
let top: number;
let cleanup: () => void;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  top = 0;
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  body = document.createElement("div");
  vi.spyOn(body, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, top, 800, 2_000));
  cleanup = () => {};
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("article engagement", () => {
  it("requires both visible time and halfway depth, and reports once", () => {
    const onRead = vi.fn();
    cleanup = observeArticleEngagement(body, onRead);
    vi.advanceTimersByTime(30_000);
    expect(onRead).not.toHaveBeenCalled();

    top = -400;
    window.dispatchEvent(new Event("scroll"));
    expect(onRead).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(30_000);
    expect(onRead).toHaveBeenCalledOnce();
  });
});
