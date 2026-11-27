import { describe, expect, it } from "vitest";
import { localizedProjects } from "@/lib/projects";
import { buildJsonLd, serializeJsonLd } from "@/lib/seo";

describe("SEO metadata", () => {
  it("serializes JSON-LD without executable HTML delimiters", () => {
    const serialized = serializeJsonLd({ text: "</script><script>alert(1)</script>& " });

    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    expect(JSON.parse(serialized)).toEqual({ text: "</script><script>alert(1)</script>& " });
  });

  it("emits CollectionPage and SoftwareApplication ItemList for the projects hub", () => {
    const projects = localizedProjects("en");
    const jsonLd = buildJsonLd(
      {
        title: "Projects",
        description: "Tools built by XingKaiXin.",
        url: "https://xingkaixin.me/en/projects/",
        type: "webpage",
        projects,
      },
      "en",
    );

    const graph = jsonLd["@graph"] as Array<Record<string, unknown>>;
    const collection = graph.find((node) => node["@type"] === "CollectionPage");
    const itemList = graph.find((node) => node["@type"] === "ItemList") as
      | { numberOfItems: number; itemListElement: Array<{ item: Record<string, unknown> }> }
      | undefined;

    expect(collection?.mainEntity).toEqual({
      "@id": "https://xingkaixin.me/en/projects/#itemlist",
    });
    expect(itemList?.numberOfItems).toBe(projects.length);
    expect(itemList?.itemListElement[0]?.item["@type"]).toBe("SoftwareApplication");
    expect(itemList?.itemListElement[0]?.item.description).toBe(projects[0]?.description);
  });
});
