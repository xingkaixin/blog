// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachPostOriginalSwitch,
  clearOriginalSnapshotCache,
  parseOriginalPostHtml,
  stripEnhancedProse,
  type PostContentChangedDetail,
} from "./post-original-switch";
import { POST_CONTENT_CHANGED_EVENT } from "./site-events";

const ORIGINAL_POST_HTML = `<!doctype html>
<html lang="zh-CN">
  <body>
    <h1 data-post-title>AI 开了“深度思考”</h1>
    <p data-post-summary>探索先用低档，有客观校验再提档。</p>
    <span data-post-word-count data-word-count="1482">1,482 字</span>
    <span data-post-reading-minutes data-reading-minutes="4">4 分钟</span>
    <div class="article-prose" data-quote-scope>
      <p>中文正文第一段。</p>
      <h2 id="zh-section-1">多出来的时间花在验证上</h2>
      <p>中文正文第二段。</p>
    </div>
    <nav data-toc-track>
      <a data-toc-link="zh-section-1" data-toc-depth="2" href="#zh-section-1">多出来的时间花在验证上</a>
      <a data-toc-link="zh-sub-1" data-toc-depth="3" href="#zh-sub-1">细分子节</a>
    </nav>
  </body>
</html>`;

function mountEnglishPostDom() {
  document.documentElement.lang = "en";
  document.body.innerHTML = `
    <span data-compact-title>Where Does the Extra Time Go?</span>
    <span data-breadcrumb-current>Where Does the Extra Time Go?</span>
    <h1 data-post-title>Where Does the Extra Time Go?</h1>
    <p data-post-summary>Explore on low effort, then bump up.</p>
    <span data-post-word-count data-word-count="618">618 words</span>
    <span data-post-reading-minutes data-reading-minutes="3">3 min read</span>
    <a href="/posts/ai-thinking-effort/" data-original-toggle-link>Read Chinese original</a>
    <aside
      data-ai-translation-notice
      data-post-original-switch
      data-original-href="/posts/ai-thinking-effort/"
      data-current-href="/en/posts/ai-thinking-effort/"
      data-ui-locale="en"
      data-content-lang="en"
    >
      <span data-translation-badge>AI Translation</span>
      <span data-translation-status>AI-translated from Chinese · Site UI stays in English.</span>
      <div data-lang-segmented data-active="en">
        <button type="button" data-content-lang-target="en" aria-pressed="true">English (AI)</button>
        <button type="button" data-content-lang-target="zh" aria-pressed="false">中文原文</button>
      </div>
    </aside>
    <div class="article-prose" data-quote-scope data-highlight-path="/en/posts/ai-thinking-effort/">
      <p>English <mark data-article-highlight="hl-1">lead</mark> paragraph.</p>
      <div class="code-block-shell">
        <div class="code-block-bar"><button class="code-block-copy">Copy</button></div>
        <pre data-language="bash"><code>/effort max</code></pre>
      </div>
      <h2 id="en-section-1">Higher effort<button data-heading-anchor="en-section-1" class="heading-anchor">#</button></h2>
      <img src="/posts/images/demo.png" alt="Demo" data-zoomable tabindex="0" role="button" aria-label="Zoom image: Demo" />
    </div>
    <dd data-copyright-title>Where Does the Extra Time Go?</dd>
    <nav data-toc-track>
      <a data-toc-link="en-section-1" data-toc-depth="2" href="#en-section-1">Higher effort</a>
    </nav>
  `;
}

describe("post-original-switch", () => {
  afterEach(() => {
    clearOriginalSnapshotCache();
    document.body.innerHTML = "";
  });

  it("strips client-injected prose enhancements while keeping semantic markup", () => {
    mountEnglishPostDom();
    const prose = document.querySelector<HTMLElement>("[data-quote-scope]")!;
    const stripped = stripEnhancedProse(prose);

    expect(stripped).not.toContain("code-block-shell");
    expect(stripped).not.toContain("code-block-bar");
    expect(stripped).not.toContain("data-heading-anchor");
    expect(stripped).not.toContain("data-article-highlight");
    expect(stripped).not.toContain("data-zoomable");
    expect(stripped).toContain("English lead paragraph.");
    expect(stripped).toContain('<pre data-language="bash"><code>/effort max</code></pre>');
    expect(stripped).toContain('<h2 id="en-section-1">Higher effort</h2>');
  });

  it("parses original Chinese post HTML and formats metrics in English UI style", () => {
    const snapshot = parseOriginalPostHtml(ORIGINAL_POST_HTML, "/posts/ai-thinking-effort/", "en");

    expect(snapshot).not.toBeNull();
    expect(snapshot?.lang).toBe("zh");
    expect(snapshot?.title).toBe("AI 开了“深度思考”");
    expect(snapshot?.summary).toBe("探索先用低档，有客观校验再提档。");
    expect(snapshot?.wordCountText).toBe("1,482 chars");
    expect(snapshot?.readingMinutesText).toBe("4 min read");
    expect(snapshot?.tocItems).toEqual([
      { id: "zh-section-1", text: "多出来的时间花在验证上", depth: 2 },
      { id: "zh-sub-1", text: "细分子节", depth: 3 },
    ]);
  });

  it("switches article content in place to Chinese and back without changing UI locale", async () => {
    mountEnglishPostDom();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(ORIGINAL_POST_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );

    const events: PostContentChangedDetail[] = [];
    const onChanged = (event: Event) => {
      events.push((event as CustomEvent<PostContentChangedDetail>).detail);
    };
    document.addEventListener(POST_CONTENT_CHANGED_EVENT, onChanged);

    const detach = attachPostOriginalSwitch(document, fetcher);

    const zhBtn = document.querySelector<HTMLButtonElement>('[data-content-lang-target="zh"]')!;
    const enBtn = document.querySelector<HTMLButtonElement>('[data-content-lang-target="en"]')!;
    zhBtn.click();

    await vi.waitFor(() => {
      expect(document.querySelector("[data-post-title]")?.textContent).toBe("AI 开了“深度思考”");
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector<HTMLElement>("[data-quote-scope]")?.lang).toBe("zh-CN");
    expect(document.querySelector<HTMLElement>("[data-quote-scope]")?.dataset.highlightPath).toBe(
      "/posts/ai-thinking-effort/",
    );
    expect(document.querySelector("[data-post-word-count]")?.textContent).toBe("1,482 chars");
    expect(document.querySelector("[data-compact-title]")?.textContent).toBe("AI 开了“深度思考”");
    expect(document.querySelector("[data-breadcrumb-current]")?.textContent).toBe(
      "AI 开了“深度思考”",
    );
    expect(document.querySelector("[data-translation-badge]")?.textContent).toBe("Original · 中文");
    expect(events.at(-1)?.lang).toBe("zh");
    expect(events.at(-1)?.tocItems).toHaveLength(2);

    // Switching back to English reuses captured snapshot without re-fetching
    enBtn.click();
    await vi.waitFor(() => {
      expect(document.querySelector("[data-post-title]")?.textContent).toBe(
        "Where Does the Extra Time Go?",
      );
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLElement>("[data-quote-scope]")?.lang).toBe("en");
    expect(document.querySelector<HTMLElement>("[data-quote-scope]")?.dataset.highlightPath).toBe(
      "/en/posts/ai-thinking-effort/",
    );
    expect(document.querySelector("[data-quote-scope]")?.innerHTML).not.toContain(
      "code-block-shell",
    );
    expect(events.at(-1)?.lang).toBe("en");

    detach();
    document.removeEventListener(POST_CONTENT_CHANGED_EVENT, onChanged);
  });

  it("shows an error status and keeps English content when fetching original fails", async () => {
    mountEnglishPostDom();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Not Found", { status: 404 }));
    const detach = attachPostOriginalSwitch(document, fetcher);

    const zhBtn = document.querySelector<HTMLButtonElement>('[data-content-lang-target="zh"]')!;
    zhBtn.click();

    await vi.waitFor(() => {
      expect(document.querySelector("[data-translation-status]")?.textContent).toContain(
        "Couldn't load",
      );
    });

    expect(document.querySelector("[data-post-title]")?.textContent).toBe(
      "Where Does the Extra Time Go?",
    );
    expect(
      document.querySelector<HTMLElement>("[data-post-original-switch]")?.dataset.contentLang,
    ).toBe("en");

    detach();
  });
});
