// cn-fontsource 的 @font-face 缺少 font-display，会导致慢网络下标题文字阻塞渲染（FOIT）
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const path = "node_modules/cn-fontsource-smiley-sans-oblique-regular/font.css";

if (!existsSync(path)) {
  throw new Error(`Smiley Sans stylesheet not found: ${path}`);
}

const css = readFileSync(path, "utf8");
if (!css.includes("@font-face")) {
  throw new Error("Smiley Sans stylesheet no longer contains @font-face rules");
}

if (!css.includes("font-display")) {
  writeFileSync(path, css.split("@font-face {").join("@font-face {font-display: swap;"));
  console.log("✅ 已为 Smiley Sans 补上 font-display: swap");
}
