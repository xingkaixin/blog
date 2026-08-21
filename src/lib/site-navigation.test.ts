import { describe, expect, it } from "vitest";
import {
  desktopNavigation,
  isSiteRouteActive,
  mobileNavigation,
  searchNavigation,
  sitemapNavigation,
  siteStatus,
} from "@/lib/site-navigation";

describe("site navigation", () => {
  it("projects the same route facts for each consumer", () => {
    expect(mobileNavigation().map((route) => route.id)).toEqual([
      "home",
      "projects",
      "photos",
      "about",
      "feed",
    ]);
    expect(desktopNavigation().map((route) => route.path)).not.toContain("/");
    expect(searchNavigation().find((route) => route.id === "route-photos")?.href).toBe("/photos/");
    expect(searchNavigation().find((route) => route.id === "route-photos")?.hint).toBe("/photos");
    expect(searchNavigation().find((route) => route.id === "route-tags")?.href).toBe("/tags/");
    expect(sitemapNavigation().map((route) => route.href)).not.toContain("/feed.xml");
    expect(sitemapNavigation().map((route) => route.href)).toContain("/tags/");
  });

  it("normalizes active paths and derives page status", () => {
    expect(isSiteRouteActive("/photos/", "/photos")).toBe(true);
    expect(siteStatus("/posts/example/")).toBe("READING");
    expect(siteStatus("/tags/AI/")).toBe("TAG ARCHIVE");
    expect(siteStatus("/tags/")).toBe("TAGS");
    expect(siteStatus("/projects/")).toBe("PROJECTS");
  });
});
