import type { APIRoute } from "astro";
import { openApiDocument } from "@/lib/public-api";

export const GET: APIRoute = () => new Response(JSON.stringify(openApiDocument, null, 2));
