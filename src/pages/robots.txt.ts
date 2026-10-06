import { buildRobotsTxt } from "@/lib/sitemap";

export function GET() {
  return new Response(buildRobotsTxt());
}
