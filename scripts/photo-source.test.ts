import { describe, expect, it } from "vitest";
import { isSupportedPhoto } from "./lib/photo-source";

describe("photo source", () => {
  it("accepts DNG and case variants of supported image extensions", () => {
    expect(isSupportedPhoto("IMG_2971.DNG")).toBe(true);
    expect(isSupportedPhoto("IMG_5355.HEIC")).toBe(true);
    expect(isSupportedPhoto("IMG_2684.JPG")).toBe(true);
  });

  it("does not treat videos or metadata files as photos", () => {
    expect(isSupportedPhoto("IMG_6318.mov")).toBe(false);
    expect(isSupportedPhoto(".DS_Store")).toBe(false);
  });
});
