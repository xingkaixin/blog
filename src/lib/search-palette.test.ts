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
});
