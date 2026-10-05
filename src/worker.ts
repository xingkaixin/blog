import { markdownPathForPage, prefersMarkdown } from "./lib/markdown-negotiation";
import { publicApiRoutes } from "./lib/public-api";
import { siteConfig } from "./lib/site";

type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

const contentSignal = "ai-train=no, search=yes, ai-input=no";
const homepageDiscoveryLinks = [
  `<${publicApiRoutes.catalog}>; rel="api-catalog"; type="application/linkset+json"`,
  `<${publicApiRoutes.openApi}>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"`,
  `<${publicApiRoutes.docs}>; rel="service-doc"; type="text/html"`,
  `<${publicApiRoutes.llms}>; rel="describedby"; type="text/plain"`,
];

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

function addHomepageDiscoveryLinks(headers: Headers, pathname: string) {
  if (pathname === "/") {
    for (const link of homepageDiscoveryLinks) {
      headers.append("Link", link);
    }
  }
}

function responseWithHeaders(request: Request, response: Response, headers: Headers) {
  return new Response(request.method === "HEAD" ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function fetch(request: Request, env: { ASSETS: AssetFetcher }) {
  const requestUrl = new URL(request.url);
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    prefersMarkdown(request.headers.get("Accept"))
  ) {
    const markdownUrl = new URL(requestUrl);
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
      addHomepageDiscoveryLinks(headers, requestUrl.pathname);
      return new Response(markdown, {
        headers,
        status: markdownResponse.status,
        statusText: markdownResponse.statusText,
      });
    }
  }

  const response = await env.ASSETS.fetch(request);
  if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")) {
    return response;
  }

  const markdownUrl = new URL(markdownPathForPage(requestUrl.pathname), siteConfig.url);
  const headers = new Headers(response.headers);
  headers.append("Link", `<${markdownUrl}>; rel="alternate"; type="text/markdown"`);
  headers.set("Content-Signal", contentSignal);
  addVaryAccept(headers);
  addHomepageDiscoveryLinks(headers, requestUrl.pathname);
  return responseWithHeaders(request, response, headers);
}

export default { fetch };
