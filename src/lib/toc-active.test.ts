import { describe, expect, it } from "vitest";
import { resolveActiveTocId } from "@/lib/toc-active";

describe("resolveActiveTocId", () => {
  it("returns the visible heading when only one heading is active", () => {
    expect(resolveActiveTocId(["2.1", "2.2", "2.2.1"], new Set(["2.1"]), null)).toBe("2.1");
  });

  it("prefers the deepest visible heading in toc order when multiple headings are visible", () => {
    expect(resolveActiveTocId(["2", "2.1", "2.2"], new Set(["2", "2.1"]), null)).toBe("2.1");
  });

  it("moves forward when a later section becomes visible", () => {
    expect(resolveActiveTocId(["2", "2.1", "3", "3.1"], new Set(["3", "3.1"]), "2.2")).toBe("3.1");
  });

  it("keeps the previous active heading when nothing is visible", () => {
    expect(resolveActiveTocId(["2.1", "2.2", "2.2.1"], new Set(), "2.2")).toBe("2.2");
  });

  it("defaults to the first toc heading before any section becomes visible", () => {
    expect(resolveActiveTocId(["intro", "details"], new Set(), null)).toBe("intro");
  });
});
