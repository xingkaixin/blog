import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostPage } from "@/routes/post-page";

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

  it("renders the post and wires the toc active state without crashing", async () => {
    render(
      <MemoryRouter initialEntries={["/posts/2025-review"]}>
        <Routes>
          <Route path="/posts/:slug" element={<PostPage />} />
        </Routes>
      </MemoryRouter>
    );

    const firstTocLinks = await screen.findAllByRole("link", { name: /工作回顾/ });

    expect(latestObserver).not.toBeNull();
    expect(firstTocLinks.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /技术成长/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { current: "location" }).length).toBeGreaterThan(0);
    expect(document.querySelector("aside.lg\\:sticky.lg\\:top-28.lg\\:z-10")).not.toBeNull();
    expect(document.querySelector("aside > div.lg\\:sticky")).toBeNull();
  });
});
