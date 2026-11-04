import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/seo";

describe("SEO metadata", () => {
  it("serializes JSON-LD without executable HTML delimiters", () => {
    const serialized = serializeJsonLd({ text: "</script><script>alert(1)</script>& " });

    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    expect(JSON.parse(serialized)).toEqual({ text: "</script><script>alert(1)</script>& " });
  });
});
