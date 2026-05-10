import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PostPage } from "@/routes/post-page";

function hasCurrentLink(name: RegExp) {
  return screen
    .getAllByRole("link", { name })
    .some((link) => link.getAttribute("aria-current") === "location");
}

describe("PostPage", () => {
  it("renders the post and updates the active toc item on scroll", async () => {
    render(
      <MemoryRouter initialEntries={["/posts/state-of-ai"]}>
        <Routes>
          <Route path="/posts/:slug" element={<PostPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const title = "2025年人工智能现状深度研究报告：代理推理、开源格局重塑与智能经济学";

    await screen.findByRole("heading", { name: /2025年人工智能现状深度研究报告/ });
    await waitFor(() => {
      expect(document.title).toBe(`${title} | 行开心的颠倒世界`);
    });
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      title,
    );
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toBe(
      title,
    );
    expect(
      JSON.parse(
        document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')
          ?.textContent ?? "{}",
      )["@graph"].some(
        (item: { "@type"?: string; name?: string }) =>
          item["@type"] === "BlogPosting" && item.name === title,
      ),
    ).toBe(true);

    const tocLinks = await screen.findAllByRole("link", { name: /2\.1/ });

    expect(tocLinks.length).toBeGreaterThan(0);

    const summaryId = decodeURIComponent(
      screen
        .getAllByRole("link", { name: /1\. 执行摘要/ })[0]
        ?.getAttribute("href")
        ?.slice(1) ?? "",
    );
    const id21 = decodeURIComponent(tocLinks[0]?.getAttribute("href")?.slice(1) ?? "");
    const id22 = decodeURIComponent(
      screen
        .getAllByRole("link", { name: /2\.2 代理式推理/ })[0]
        ?.getAttribute("href")
        ?.slice(1) ?? "",
    );
    const tocHeadingIds = [
      ...new Set(
        screen
          .getAllByRole("link")
          .map((link) => link.getAttribute("href"))
          .filter((href): href is string => Boolean(href?.startsWith("#")))
          .map((href) => decodeURIComponent(href.slice(1))),
      ),
    ];
    const summaryHeading = document.getElementById(summaryId);
    const heading21 = document.getElementById(id21);
    const heading22 = document.getElementById(id22);

    expect(summaryHeading).not.toBeNull();
    expect(heading21).not.toBeNull();
    expect(heading22).not.toBeNull();

    if (!summaryHeading || !heading21 || !heading22) {
      throw new Error("Expected target headings to exist");
    }

    const applyHeadingTops = (tops: Record<string, number>) => {
      tocHeadingIds.forEach((id, index) => {
        const heading = document.getElementById(id);

        if (!heading) {
          return;
        }

        Object.defineProperty(heading, "getBoundingClientRect", {
          configurable: true,
          value: () => ({ top: tops[id] ?? 240 + index * 160 }),
        });
      });
    };

    applyHeadingTops({
      [summaryId]: 24,
      [id21]: 180,
      [id22]: 360,
    });

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(hasCurrentLink(/1\. 执行摘要/)).toBe(true);
      expect(hasCurrentLink(/2\.1/)).toBe(false);
      expect(hasCurrentLink(/2\.2 代理式推理/)).toBe(false);
    });

    applyHeadingTops({
      [summaryId]: -320,
      [id21]: -96,
      [id22]: 48,
    });

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(hasCurrentLink(/2\.1/)).toBe(false);
      expect(hasCurrentLink(/2\.2 代理式推理/)).toBe(true);
    });

    expect(document.querySelector("aside.lg\\:sticky.lg\\:top-28.lg\\:z-10")).not.toBeNull();
    expect(document.querySelector("aside > div.lg\\:sticky")).toBeNull();
  });
});
