import {
  markdownPathForPage,
  pageForMarkdownPath,
  prefersMarkdown,
} from "./lib/markdown-negotiation";
import { publicApiRoutes } from "./lib/public-api";
import { siteConfig } from "./lib/site";

type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

const siteHost = new URL(siteConfig.url).host;
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

function canonicalLink(pathname: string) {
  return `<${new URL(pathname, siteConfig.url)}>; rel="canonical"`;
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
  if (requestUrl.host !== siteHost) {
    return Response.redirect(
      new URL(`${requestUrl.pathname}${requestUrl.search}`, siteConfig.url).href,
      301,
    );
  }
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    prefersMarkdown(request.headers.get("Accept"))
  ) {
    const markdownUrl = new URL(requestUrl);
    markdownUrl.pathname = markdownPathForPage(markdownUrl.pathname);
    const markdownResponse = await env.ASSETS.fetch(new Request(markdownUrl, request));

    if (markdownResponse.ok || markdownResponse.status === 304) {
      const markdown =
        request.method === "HEAD" || markdownResponse.status === 304
          ? null
          : await markdownResponse.text();
      const headers = new Headers(markdownResponse.headers);
      headers.set("Content-Type", "text/markdown; charset=utf-8");
      headers.set("Content-Signal", contentSignal);
      if (markdown !== null) {
        const byteLength = new TextEncoder().encode(markdown).byteLength;
        headers.set("X-Markdown-Tokens", String(Math.ceil(byteLength / 4)));
      }
      headers.append("Link", canonicalLink(requestUrl.pathname));
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
  if (requestUrl.pathname.endsWith(".md")) {
    if (!response.ok && response.status !== 304) {
      return response;
    }
    const headers = new Headers(response.headers);
    headers.append("Link", canonicalLink(pageForMarkdownPath(requestUrl.pathname)));
    return responseWithHeaders(request, response, headers);
  }
  if (response.status === 304) {
    const headers = new Headers(response.headers);
    addVaryAccept(headers);
    return responseWithHeaders(request, response, headers);
  }
  if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")) {
    return response;
  }

  const markdownUrl = new URL(markdownPathForPage(requestUrl.pathname), siteConfig.url);
  const headers = new Headers(response.headers);
  if (!headers.get("X-Robots-Tag")?.includes("noindex")) {
    headers.append("Link", `<${markdownUrl}>; rel="alternate"; type="text/markdown"`);
  }
  headers.set("Content-Signal", contentSignal);
  addVaryAccept(headers);
  addHomepageDiscoveryLinks(headers, requestUrl.pathname);
  return responseWithHeaders(request, response, headers);
}

export default { fetch };
