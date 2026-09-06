# 页脚人物素材

使用内置 image_gen 生成，以用户提供的卷发、圆眼镜、深色 T 恤头像为人物与画风参考。PNG 是母版，页面通过 Astro Image 输出响应式 WebP。

## 生成提示词

每张图片使用以下公共提示词，加对应场景提示词：

Use case: identity-preserve. Create a production blog footer illustration asset using the attached image as CHARACTER IDENTITY and drawing STYLE reference. Preserve curly dark hair, round thin black glasses, warm pale skin, charcoal T-shirt, friendly young man, delicate hand-drawn outlines and flat softly textured colors. True transparent background, no text, no watermark, no frame. Full scene fits with generous transparent margin, landscape 3:2 composition.

### writing.png

Character seated at a simple desk, writing in an open notebook with pen, three-quarter view facing right. Small stack of books and a coffee cup, relaxed focused expression. Complete desk and seated body visible. Minimal quiet editorial illustration.

### photography.png

Character standing facing right in three-quarter profile, holding a small camera up to eye ready to photograph scenery to the right. Full body including shoes visible, camera lens at approximately 65 percent width and 33 percent height. No scenery or flash drawn; those will be animated separately.

### building.png

Character sitting at desk working on a laptop, three-quarter view facing right, hands on keyboard, focused happy expression. Complete desk and seated body visible. Small desk lamp and coffee cup. Minimal quiet editorial illustration.

### hello.png

Character standing front-facing and waving hello with open hand, cheerful smile. Full body including trousers and shoes visible. No furniture, no extra ornaments. Character centered.

## 透明背景修正

摄影、工具箱和招呼场景额外使用内置工具移除底色，保留人物姿态与颜色。工具箱同时移除墙面画框与置物架。最终四张图片均包含 alpha 通道。
