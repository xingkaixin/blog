// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { skipToContent } from "./skip-to-content";

const scrollIntoView = vi.fn();

beforeEach(() => {
  window.history.replaceState({ index: 1 }, "", "/photos/#album=trip");
  document.body.innerHTML =
    '<a href="#main-content">跳到正文</a><main id="main-content" tabindex="-1"></main>';
  document.addEventListener("click", skipToContent, true);
  scrollIntoView.mockClear();
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(scrollIntoView);
});

afterEach(() => {
  document.removeEventListener("click", skipToContent, true);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("skip to content", () => {
  it("moves focus and scroll without changing the URL or history", () => {
    const href = window.location.href;
    const historyLength = history.length;
    const main = document.getElementById("main-content")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("a")!.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(main);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
    expect(window.location.href).toBe(href);
    expect(history.length).toBe(historyLength);
    expect(history.state).toEqual({ index: 1 });
  });

  it("uses the current content after an Astro page swap", () => {
    const previousMain = document.getElementById("main-content");
    document.body.innerHTML =
      '<a href="#main-content"><span>跳到正文</span></a><main id="main-content" tabindex="-1"></main>';
    document
      .querySelector("span")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(document.activeElement).toBe(document.getElementById("main-content"));
    expect(document.activeElement).not.toBe(previousMain);
  });

  it("leaves ordinary fragment links to the browser", () => {
    document.querySelector("a")!.href = "#chapter";
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("a")!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("preserves modified link clicks", () => {
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    document.querySelector("a")!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
