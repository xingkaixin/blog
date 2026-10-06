import { describe, expect, it } from "vitest";
import worker from "./worker";

const env = {
  ASSETS: {
    async fetch(request: Request) {
      const { pathname } = new URL(request.url);
      if (request.headers.has("If-None-Match") && (pathname === "/" || pathname === "/index.md")) {
        return new Response(null, { status: 304, headers: { ETag: '"cached"' } });
      }
      if (pathname === "/index.md") {
        return new Response(request.method === "HEAD" ? null : "# 博客", {
          headers: { "Content-Type": "text/plain", "Cache-Control": "max-age=0" },
        });
      }
      if (pathname === "/" || pathname === "/about/") {
        return new Response(request.method === "HEAD" ? null : "<h1>博客</h1>", {
          headers: { "Content-Type": "text/html", Vary: "Accept-Encoding" },
        });
      }
      if (pathname === "/analytics/") {
        return new Response("<h1>统计</h1>", {
          headers: { "Content-Type": "text/html", "X-Robots-Tag": "noindex" },
        });
      }
      if (pathname === "/old-post") {
        return new Response(null, { status: 301, headers: { Location: "/posts/example/" } });
      }
      return new Response("Not found", { status: 404 });
    },
  },
};

describe("Worker content negotiation", () => {
  it("preserves HTML and adds Markdown and API discovery headers", async () => {
    const response = await worker.fetch(new Request("https://xingkaixin.me/"), env);

    expect(await response.text()).toBe("<h1>博客</h1>");
    expect(response.headers.get("Vary")).toBe("Accept-Encoding, Accept");
    expect(response.headers.get("Link")).toContain('rel="alternate"; type="text/markdown"');
    expect(response.headers.get("Link")).toContain('rel="api-catalog"');
    expect(response.headers.get("Content-Signal")).toBe("ai-train=no, search=yes, ai-input=no");
  });

  it.each(["GET", "HEAD"])("serves Markdown for %s on the same page URL", async (method) => {
    const request = new Request("https://xingkaixin.me/?ref=test", {
      method,
      headers: { Accept: "text/markdown" },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(response.headers.get("Cache-Control")).toBe("max-age=0");
    expect(response.headers.get("Link")).toContain('rel="api-catalog"');
    expect(response.headers.get("Link")).toContain('<https://xingkaixin.me/>; rel="canonical"');
    expect(await response.text()).toBe(method === "HEAD" ? "" : "# 博客");
  });

  it("adds the page canonical to direct Markdown requests", async () => {
    const response = await worker.fetch(new Request("https://xingkaixin.me/index.md"), env);

    expect(await response.text()).toBe("# 博客");
    expect(response.headers.get("Link")).toBe('<https://xingkaixin.me/>; rel="canonical"');
  });

  it("does not advertise Markdown for noindex pages", async () => {
    const response = await worker.fetch(new Request("https://xingkaixin.me/analytics/"), env);

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.has("Link")).toBe(false);
  });

  it.each(["text/markdown", "text/html"])(
    "keeps 304 for %s and varies on Accept",
    async (accept) => {
      const request = new Request("https://xingkaixin.me/", {
        headers: { Accept: accept, "If-None-Match": '"cached"' },
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(304);
      expect(response.headers.get("Vary")).toBe("Accept");
      expect(response.body).toBeNull();
    },
  );

  it("falls back to HTML when a page has no Markdown asset", async () => {
    const request = new Request("https://xingkaixin.me/about/", {
      headers: { Accept: "text/markdown" },
    });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(await response.text()).toBe("<h1>博客</h1>");
    expect(response.headers.get("Link")).not.toContain('rel="api-catalog"');
  });

  it.each([
    ["/old-post", 301],
    ["/missing/", 404],
  ])("preserves the asset response for %s", async (pathname, status) => {
    const response = await worker.fetch(new Request(`https://xingkaixin.me${pathname}`), env);

    expect(response.status).toBe(status);
    expect(response.headers.has("Content-Signal")).toBe(false);
    if (status === 301) {
      expect(response.headers.get("Location")).toBe("/posts/example/");
    }
  });
});
