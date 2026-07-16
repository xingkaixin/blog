import { describe, expect, it } from "vitest";
import glyphData from "../src/lib/dancing-script-glyph-data.json";
import { siteConfig } from "../src/lib/site";
import { selectSignatureGlyphs, signatureCharacters } from "./generate-signature-glyphs";

describe("signature glyph subset", () => {
  it("contains exactly the configured author characters", () => {
    expect(Object.keys(glyphData).toSorted()).toEqual(
      signatureCharacters(siteConfig.author).toSorted(),
    );
  });

  it("rejects an author character absent from the source data", () => {
    expect(() => selectSignatureGlyphs({ X: {} }, "Xi")).toThrow("Missing signature glyphs: i");
  });
});
