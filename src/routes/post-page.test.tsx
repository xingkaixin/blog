import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostPage } from "@/routes/post-page";

function hasCurrentLink(name: RegExp) {
  return screen
    .getAllByRole("link", { name })
    .some((link) => link.getAttribute("aria-current") === "location");
}

type ObserverCallback = ConstructorParameters<typeof IntersectionObserver>[0];

class IntersectionObserverMock {
  callback: ObserverCallback;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn();

  disconnect = vi.fn();

  unobserve = vi.fn();

  takeRecords = vi.fn(() => []);
}

let latestObserver: IntersectionObserverMock | null = null;

describe("PostPage", () => {
  beforeEach(() => {
    latestObserver = null;
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn((callback: ObserverCallback) => {
        latestObserver = new IntersectionObserverMock(callback);
        return latestObserver;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the post and wires the toc active state without crashing", () => {
    render(
      <MemoryRouter initialEntries={["/posts/state-of-ai"]}>
        <Routes>
          <Route path="/posts/:slug" element={<PostPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByRole("link", { name: /2\.1/ }).length).toBeGreaterThan(0);
    expect(hasCurrentLink(/1\. 执行摘要/)).toBe(true);
    expect(latestObserver).not.toBeNull();

    const id21 = decodeURIComponent(screen.getAllByRole("link", { name: /2\.1/ })[0]?.getAttribute("href")?.slice(1) ?? "");
    const id22 = decodeURIComponent(
      screen.getAllByRole("link", { name: /2\.2 代理式推理/ })[0]?.getAttribute("href")?.slice(1) ?? ""
    );
    const tailId = decodeURIComponent(
      screen.getAllByRole("link", { name: /引用的著作/ })[0]?.getAttribute("href")?.slice(1) ?? ""
    );
    const heading21 = document.getElementById(id21);
    const heading22 = document.getElementById(id22);
    const tailHeading = document.getElementById(tailId);

    expect(heading21).not.toBeNull();
    expect(heading22).not.toBeNull();
    expect(tailHeading).not.toBeNull();

    if (!latestObserver || !heading21 || !heading22 || !tailHeading) {
      throw new Error("Expected observer and target headings to exist");
    }

    act(() => {
      latestObserver.callback(
        [{ target: heading21, isIntersecting: true } as IntersectionObserverEntry],
        latestObserver as unknown as IntersectionObserver
      );
    });

    expect(hasCurrentLink(/2\.1/)).toBe(true);
    expect(hasCurrentLink(/2\.2 代理式推理/)).toBe(false);
    expect(hasCurrentLink(/引用的著作/)).toBe(false);

    act(() => {
      latestObserver.callback(
        [
          { target: heading21, isIntersecting: true } as IntersectionObserverEntry,
          { target: heading22, isIntersecting: true } as IntersectionObserverEntry,
        ],
        latestObserver as unknown as IntersectionObserver
      );
    });

    expect(hasCurrentLink(/2\.1/)).toBe(false);
    expect(hasCurrentLink(/2\.2 代理式推理/)).toBe(true);
    expect(hasCurrentLink(/引用的著作/)).toBe(false);

    act(() => {
      latestObserver.callback(
        [{ target: heading21, isIntersecting: false } as IntersectionObserverEntry],
        latestObserver as unknown as IntersectionObserver
      );
    });

    expect(hasCurrentLink(/2\.2 代理式推理/)).toBe(true);
    expect(hasCurrentLink(/引用的著作/)).toBe(false);

    act(() => {
      latestObserver.callback(
        [{ target: tailHeading, isIntersecting: false } as IntersectionObserverEntry],
        latestObserver as unknown as IntersectionObserver
      );
    });

    expect(hasCurrentLink(/2\.2 代理式推理/)).toBe(true);
    expect(hasCurrentLink(/引用的著作/)).toBe(false);

    expect(document.querySelector("aside.lg\\:sticky.lg\\:top-28.lg\\:z-10")).not.toBeNull();
    expect(document.querySelector("aside > div.lg\\:sticky")).toBeNull();
  });
});
