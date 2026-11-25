# 首页人物素材

使用内置 image_gen 生成，以用户提供的卷发、圆眼镜、深色 T 恤头像为人物与画风参考。PNG 是母版，页面通过 Astro Image 输出响应式 WebP。

## 生成提示词

每张图片使用以下公共提示词，加对应场景提示词：

Use case: identity-preserve. Create a production blog footer illustration asset using the attached image as CHARACTER IDENTITY and drawing STYLE reference. Preserve curly dark hair, round thin black glasses, warm pale skin, charcoal T-shirt, friendly young man, delicate hand-drawn outlines and flat softly textured colors. True transparent background, no text, no watermark, no frame. Full scene fits with generous transparent margin, landscape 3:2 composition.

### photography.png

Character standing facing right in three-quarter profile, holding a small camera up to eye ready to photograph scenery to the right. Full body including shoes visible, camera lens at approximately 65 percent width and 33 percent height. No scenery or flash drawn; those will be animated separately.

### building.png

Character sitting at desk working on a laptop, three-quarter view facing right, hands on keyboard, focused happy expression. Complete desk and seated body visible. Small desk lamp and coffee cup. Minimal quiet editorial illustration.

### hello.png

Character standing front-facing and waving hello with open hand, cheerful smile. Full body including trousers and shoes visible. No furniture, no extra ornaments. Character centered.

## 透明背景修正

摄影、工具箱和招呼场景额外使用内置工具移除底色，保留人物姿态与颜色。工具箱同时移除墙面画框与置物架。最终三张图片均包含 alpha 通道。

## 文章页脚水彩线稿插画

母版 `article-footer-master.png`（1536×1024 纯白底 RGB PNG）由 `codex/gpt-6.2-sol (high)` 内置生图生成：左上保留空白给页脚文案，左下为芦苇、苔石与系泊木船，右侧为湖畔木结构书屋、木拱桥、松柏与朱红枫树。

运行 `bun scripts/build-article-footer-art.ts` 会将母版裁切为 3.6:1 横幅并拆分为像素对齐的双层压缩纹理：

- **线稿层（`article-line-*.{avif,webp}`）**：单通道不透明灰度图（黑底白线，Shader 读 `.r` 通道并由 `--ink-700` 着色），桌面端 1200px、移动端 800px。
- **水彩层（`article-wash-*.{avif,webp}`）**：去除墨线并扩散补色后的半分辨率 RGBA 淡彩图，桌面端 800px、移动端 480px。

渲染器在 `src/lib/article-footer-scene.ts` 中，仅在文章详情页（`meta.type === "article"`）挂载：页脚距离视口 200px 时预加载纹理，露出超过 50% 高度时触发一次线稿扫绘 → 水彩晕染（2.7s），随后烘焙至 FBO 离屏缓存并切到 15–30fps 轻量流云薄雾动效。
