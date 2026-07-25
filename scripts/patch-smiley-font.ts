// cn-fontsource 的 @font-face 缺少 font-display，会导致慢网络下标题文字阻塞渲染（FOIT）
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const FONT_CSS_PATH = "node_modules/cn-fontsource-smiley-sans-oblique-regular/font.css";

// 只改写还没有 font-display 的规则，因此重复执行安全，也不假设上游的空白排版。
const UNPATCHED_FONT_FACE = /@font-face\s*\{(?![^{}]*font-display)/g;

export function patchFontDisplay(css: string) {
  return css.replaceAll(UNPATCHED_FONT_FACE, "@font-face{font-display:swap;");
}

// 该脚本挂在 postinstall 上，任何抛错都会让 bun install 整体失败。上游包结构变化
// 只值得一条警告——字体本身照常可用，代价仅是 FOIT 回归，由单测负责发现。
function main() {
  if (!existsSync(FONT_CSS_PATH)) {
    console.warn(`⚠️  未找到 Smiley Sans 样式表，跳过 font-display 补丁：${FONT_CSS_PATH}`);
    return;
  }

  const css = readFileSync(FONT_CSS_PATH, "utf8");
  if (!css.includes("@font-face")) {
    console.warn("⚠️  Smiley Sans 样式表不再包含 @font-face 规则，跳过 font-display 补丁");
    return;
  }

  const patched = patchFontDisplay(css);
  if (patched !== css) {
    writeFileSync(FONT_CSS_PATH, patched);
    console.log("✅ 已为 Smiley Sans 补上 font-display: swap");
  }
}

if (import.meta.main) {
  main();
}
