import { describe, expect, it } from "vitest";
import { apiCatalog, openApiDocument, publicApiRoutes } from "./public-api";

describe("public API discovery", () => {
  it("publishes complete RFC 9727 linkset entries", () => {
    expect(apiCatalog.linkset).not.toHaveLength(0);
    for (const entry of apiCatalog.linkset) {
      expect(new URL(entry.anchor).protocol).toBe("https:");
      expect(entry["service-desc"]).not.toHaveLength(0);
      expect(entry["service-doc"]).not.toHaveLength(0);
      expect(entry["service-desc"].every((link) => new URL(link.href).protocol === "https:")).toBe(
        true,
      );
      expect(entry["service-doc"].every((link) => new URL(link.href).protocol === "https:")).toBe(
        true,
      );
    }
  });

  it("describes every public API route", () => {
    expect(openApiDocument.paths).toHaveProperty(publicApiRoutes.index);
    expect(openApiDocument.paths).toHaveProperty(publicApiRoutes.post);
  });
});
