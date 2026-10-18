import { cookieLocale, localeFromPath, preferredLocale, translatedPath } from "./lib/i18n";
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

function addVary(headers: Headers, ...fields: string[]) {
  const values =
    headers
      .get("Vary")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const missing = fields.filter(
    (field) => !values.some((value) => value.toLowerCase() === field.toLowerCase()),
  );
  if (missing.length > 0) {
    headers.set("Vary", [...values, ...missing].join(", "));
  }
}

function addVaryAccept(headers: Headers, pathname: string) {
  addVary(headers, "Accept");
  if (isChineseBilingualPage(pathname)) {
    addVary(headers, "Accept-Language", "Cookie");
  }
}

function isChineseBilingualPage(pathname: string) {
  return localeFromPath(pathname) === "zh" && translatedPath(pathname, "en") !== null;
}

/** 中文双语页按访客的语言选择跳到英文版；手动选择记在 cookie 里，优先于浏览器语言。 */
function englishRedirect(request: Request, url: URL) {
  const englishPath = translatedPath(url.pathname, "en");
  if (!isChineseBilingualPage(url.pathname) || !englishPath) {
    return null;
  }
  const locale =
    cookieLocale(request.headers.get("Cookie")) ??
    preferredLocale(request.headers.get("Accept-Language"));
  if (locale !== "en") {
    return null;
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(`${englishPath}${url.search}`, siteConfig.url).href,
      Vary: "Accept, Accept-Language, Cookie",
    },
  });
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
      addVary(headers, "Accept");
      addHomepageDiscoveryLinks(headers, requestUrl.pathname);
      return new Response(markdown, {
        headers,
        status: markdownResponse.status,
        statusText: markdownResponse.statusText,
      });
    }
  }

  if (request.method === "GET" || request.method === "HEAD") {
    const redirect = englishRedirect(request, requestUrl);
    if (redirect) {
      return redirect;
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
    addVaryAccept(headers, requestUrl.pathname);
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
  addVaryAccept(headers, requestUrl.pathname);
  addHomepageDiscoveryLinks(headers, requestUrl.pathname);
  return responseWithHeaders(request, response, headers);
}

export default { fetch };
