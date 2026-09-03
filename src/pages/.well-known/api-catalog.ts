import type { APIRoute } from "astro";
import { apiCatalog, publicApiRoutes } from "@/lib/public-api";
import { siteConfig } from "@/lib/site";

const profile = "https://www.rfc-editor.org/info/rfc9727";
const catalogUrl = new URL(publicApiRoutes.catalog, `${siteConfig.url}/`).href;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(apiCatalog, null, 2), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": `application/linkset+json; profile="${profile}"`,
      Link: `<${catalogUrl}>; rel="api-catalog"`,
      "X-Robots-Tag": "noindex, follow",
    },
  });
