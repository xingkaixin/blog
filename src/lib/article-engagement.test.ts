// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeArticleEngagement } from "./article-engagement";

let body: HTMLElement;
let top: number;
let hidden: boolean;
let cleanup: () => void;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  hidden = false;
  top = 0;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
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

  it("does not count time in a background tab", () => {
    const onRead = vi.fn();
    top = -400;
    cleanup = observeArticleEngagement(body, onRead);
    vi.advanceTimersByTime(10_000);
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000);
    expect(onRead).not.toHaveBeenCalled();

    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(19_999);
    expect(onRead).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onRead).toHaveBeenCalledOnce();
  });

  it("does not report after navigating away", () => {
    const onRead = vi.fn();
    top = -400;
    cleanup = observeArticleEngagement(body, onRead);
    vi.advanceTimersByTime(10_000);
    cleanup();
    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event("scroll"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onRead).not.toHaveBeenCalled();
  });

  it("does not treat jumping past the article as reading it", () => {
    const onRead = vi.fn();
    top = -3_000;
    cleanup = observeArticleEngagement(body, onRead);
    vi.advanceTimersByTime(30_000);
    expect(onRead).not.toHaveBeenCalled();
  });
});
