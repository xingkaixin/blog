import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FONT_CSS_PATH, patchFontDisplay } from "./patch-smiley-font";

const FONT_FACE_START = /@font-face\s*\{/g;
const PATCHED_FONT_FACE = /@font-face\s*\{[^{}]*font-display/g;

function countMatches(css: string, pattern: RegExp) {
  return css.match(pattern)?.length ?? 0;
}

describe("patchFontDisplay", () => {
  it("injects font-display into every rule", () => {
    const css = "@font-face {font-family: A;}\n@font-face{font-family: B;}";
    const patched = patchFontDisplay(css);

    expect(countMatches(patched, PATCHED_FONT_FACE)).toBe(2);
  });

  it("is idempotent and leaves already-patched rules alone", () => {
    const css = "@font-face {font-display: swap;font-family: A;}@font-face{font-family: B;}";
    const once = patchFontDisplay(css);

    expect(once).toBe(patchFontDisplay(once));
    expect(countMatches(once, PATCHED_FONT_FACE)).toBe(2);
    expect(once).toContain("font-display: swap;font-family: A;");
  });

  // postinstall 的失败已降级为警告，所以补丁悄悄失效不会中断安装——这条用例是它唯一的告警口。
  it("leaves no unpatched rule in the installed stylesheet", () => {
    if (!existsSync(FONT_CSS_PATH)) {
      throw new Error(`${FONT_CSS_PATH} is missing; run bun install first`);
    }

    const css = readFileSync(FONT_CSS_PATH, "utf8");
    expect(countMatches(css, PATCHED_FONT_FACE)).toBe(countMatches(css, FONT_FACE_START));
  });
});
