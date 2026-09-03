import type { APIRoute } from "astro";
import { openApiDocument } from "@/lib/public-api";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(openApiDocument, null, 2), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/vnd.oai.openapi+json;version=3.1",
      "X-Robots-Tag": "noindex, follow",
    },
  });
