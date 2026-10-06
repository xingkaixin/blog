import type { APIRoute } from "astro";
import { apiCatalog } from "@/lib/public-api";

export const GET: APIRoute = () => new Response(JSON.stringify(apiCatalog, null, 2));
