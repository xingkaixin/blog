import { describe, expect, it } from "vitest";
import glyphData from "../src/lib/generated/dancing-script-glyph-data.json";
import { siteConfig } from "../src/lib/site";
import { signatureCharacters } from "./generate-signature-glyphs";

describe("signature glyph subset", () => {
  it("contains exactly the configured author characters", () => {
    expect(Object.keys(glyphData).toSorted()).toEqual(
      signatureCharacters(siteConfig.author).toSorted(),
    );
  });
});
