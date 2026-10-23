import { describe, expect, it } from "vitest";
import {
  desktopNavigation,
  isSiteRouteActive,
  mobileNavigation,
  normalizeSitePath,
  searchNavigation,
  sitemapNavigation,
} from "@/lib/site-navigation";

describe("site navigation", () => {
  it("projects the same route facts for each consumer", () => {
    expect(mobileNavigation().map((route) => route.id)).toEqual([
      "home",
      "posts",
      "projects",
      "photos",
      "feed",
    ]);
    expect(desktopNavigation().map((route) => route.path)).not.toContain("/");
    expect(searchNavigation().find((route) => route.id === "route-photos")?.href).toBe("/photos/");
    expect(searchNavigation().find((route) => route.id === "route-photos")?.hint).toBe("/photos");
    expect(searchNavigation().find((route) => route.id === "route-tags")?.href).toBe("/tags/");
    expect(desktopNavigation().find((route) => route.href === "/rss/")?.reload).toBe(false);
    expect(mobileNavigation().find((route) => route.id === "feed")?.reload).toBe(false);
    expect(searchNavigation().find((route) => route.id === "route-feed")?.reload).toBe(false);
    expect(searchNavigation().find((route) => route.id === "route-photos")?.reload).toBe(false);
    expect(sitemapNavigation().map((route) => route.href)).not.toContain("/feed.xml");
    expect(sitemapNavigation().map((route) => route.href)).toContain("/tags/");
  });

  it("normalizes active paths", () => {
    expect(isSiteRouteActive("/photos/", "/photos")).toBe(true);
  });

  it.each(["100%25", "%2525", "C%2FC%2B%2B", "%E4%B8%AD%E6%96%87", "raw%"])(
    "keeps URL encoding intact when normalizing /tags/%s/ repeatedly",
    (tag) => {
      const path = normalizeSitePath(`/tags/${tag}/`);
      expect(path).toBe(`/tags/${tag}`);
      expect(normalizeSitePath(path)).toBe(path);
      expect(isSiteRouteActive(path, "/photos")).toBe(false);
    },
  );
});
