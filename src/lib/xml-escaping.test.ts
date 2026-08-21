import { describe, expect, it } from "vitest";
import { escapeXml } from "@/lib/xml-escaping";

describe("XML escaping", () => {
  it("escapes XML text and attribute delimiters", () => {
    expect(escapeXml(`A&B <tag attr="value">'text'</tag>`)).toBe(
      "A&amp;B &lt;tag attr=&quot;value&quot;&gt;&apos;text&apos;&lt;/tag&gt;",
    );
  });
});
