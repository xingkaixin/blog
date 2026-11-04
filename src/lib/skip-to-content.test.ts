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
});
