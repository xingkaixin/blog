import { describe, expect, it } from "vitest";
import { buildSearchPalette } from "./search-palette";

describe("search palette", () => {
  it("keeps commands searchable while the post index is unavailable", () => {
    const groups = buildSearchPalette("主题", null);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("命令");
    expect(groups[0].items).toContainEqual(
      expect.objectContaining({ id: "action-theme", kind: "theme" }),
    );
  });

  it("groups experiments separately and finds them without the post index", () => {
    for (const query of ["", "实验", "logo", "生日"]) {
      const group = buildSearchPalette(query, null).find(({ label }) => label === "实验");
      expect(group?.items).toContainEqual(
        expect.objectContaining({ kind: "link", href: "/lab/logos/", reload: false }),
      );
    }
    const group = buildSearchPalette("experiments", null, "en").find(
      ({ label }) => label === "Experiments",
    );
    expect(group?.items[0].title).toBe("Holiday Logo Workshop (Chinese)");
  });
});
