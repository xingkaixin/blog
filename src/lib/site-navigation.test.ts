import { describe, expect, it } from "vitest";
import {
  desktopNavigation,
  isSiteRouteActive,
  mobileNavigation,
  normalizeSitePath,
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
    expect(desktopNavigation().find((route) => route.href === "/feed.xml")?.reload).toBe(true);
    expect(mobileNavigation().find((route) => route.id === "feed")?.reload).toBe(true);
    expect(searchNavigation().find((route) => route.id === "route-feed")?.reload).toBe(true);
    expect(searchNavigation().find((route) => route.id === "route-photos")?.reload).toBe(false);
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

  it.each(["100%25", "%2525", "C%2FC%2B%2B", "%E4%B8%AD%E6%96%87", "raw%"])(
    "keeps URL encoding intact when normalizing /tags/%s/ repeatedly",
    (tag) => {
      const path = normalizeSitePath(`/tags/${tag}/`);
      expect(path).toBe(`/tags/${tag}`);
      expect(normalizeSitePath(path)).toBe(path);
      expect(siteStatus(path)).toBe("TAG ARCHIVE");
      expect(isSiteRouteActive(path, "/photos")).toBe(false);
    },
  );
});
