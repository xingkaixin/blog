import { markdownPathForPage, prefersMarkdown } from "../src/lib/markdown-negotiation";
import { siteConfig } from "../src/lib/site";

type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

type PagesContext = {
  env: { ASSETS: AssetFetcher };
  next(): Promise<Response>;
  request: Request;
};

const contentSignal = "ai-train=no, search=yes, ai-input=no";

function addVaryAccept(headers: Headers) {
  const vary = headers.get("Vary");
  const values = vary
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!values?.some((value) => value.toLowerCase() === "accept")) {
    headers.set("Vary", [...(values ?? []), "Accept"].join(", "));
  }
}

function responseWithHeaders(request: Request, response: Response, headers: Headers) {
  return new Response(request.method === "HEAD" ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export async function onRequest(context: PagesContext) {
  const { env, request } = context;
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    prefersMarkdown(request.headers.get("Accept"))
  ) {
    const markdownUrl = new URL(request.url);
    markdownUrl.pathname = markdownPathForPage(markdownUrl.pathname);
    const markdownResponse = await env.ASSETS.fetch(new Request(markdownUrl, request));

    if (markdownResponse.ok) {
      const markdown = request.method === "HEAD" ? null : await markdownResponse.text();
      const headers = new Headers(markdownResponse.headers);
      headers.set("Content-Type", "text/markdown; charset=utf-8");
      headers.set("Content-Signal", contentSignal);
      if (markdown !== null) {
        const byteLength = new TextEncoder().encode(markdown).byteLength;
        headers.set("X-Markdown-Tokens", String(Math.ceil(byteLength / 4)));
      }
      addVaryAccept(headers);
      return new Response(markdown, {
        headers,
        status: markdownResponse.status,
        statusText: markdownResponse.statusText,
      });
    }
  }

  const response = await context.next();
  if (!response.headers.get("Content-Type")?.includes("text/html")) {
    return response;
  }

  const requestUrl = new URL(request.url);
  const markdownUrl = new URL(markdownPathForPage(requestUrl.pathname), siteConfig.url);
  const headers = new Headers(response.headers);
  headers.append("Link", `<${markdownUrl}>; rel="alternate"; type="text/markdown"`);
  headers.set("Content-Signal", contentSignal);
  addVaryAccept(headers);
  return responseWithHeaders(request, response, headers);
}
