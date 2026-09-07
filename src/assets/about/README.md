# 关于页沙发人物

使用内置 image_gen，以 `public/avatar.webp` 作为身份和画风参考。母版为 `sofa-character.png`，页面通过 Astro 输出约 120 KB 的 WebP。

母版包含左侧沙发与身体、右侧独立头部。生成工具两次均未提供真正的 alpha，背景是烘焙的棋盘格；`AboutCharacter.astro` 中的两个 SVG 轮廓负责裁切，不要将这张母版直接作为完整图片展示。替换母版时必须重新对齐裁切轮廓、脖子和五官位置。

五官、眼镜和瞳孔由 SVG 绘制，方便独立跟随。头部以脖子为支点小幅旋转，五官和瞳孔分别偏移；这是有限角度的二维分层效果，没有三维模型或完整面部网格。鼠标停下后动画收敛并停止，离开窗口回正；触屏、减少动态效果、离屏和隐藏标签页使用静态姿态。自定义元素断开时清理监听与动画帧，支持 Astro 页面切换。

## 生成提示词

Use case: identity-preserve. Create a production transparent illustration sprite sheet for a personal blog interactive character. Reference image is identity and hand-drawn style reference: curly charcoal hair, warm cream skin, round thin dark glasses, dark T shirt, friendly young man, soft pencil outlines, muted textured color. Layout: landscape 1536x1024 transparent canvas, TWO SEPARATE NON-OVERLAPPING ASSETS. LEFT 70%: complete cozy muted sage-green two-seat sofa, person lounging comfortably sitting in it, dark T-shirt, charcoal trousers, off-white sneakers, one arm resting along sofa arm, relaxed legs, complete furniture and shoes visible. Person's body has a short complete neck but NO HEAD (head is separate animation part). Neck ends at around x=535 y=310. Sofa and body fit between x=60..1030 and y=280..950. RIGHT 30%: separate oversized front-facing HEAD ONLY centered x=1280 y=270, fits x=1100..1460 y=50..470, curly dark hair, ears, warm cream face, but NO facial features at all: no eyes, no eyebrows, no nose, no mouth, no glasses. Blank face will get animated features in browser. Head needs cute round proportions matching original avatar. A clean rig asset sheet, the head/body separation intentional. Genuine transparent alpha background, no backdrop, no text, no labels, no border, no watermark, no shadows outside sofa except small grounding shadow. Keep ALL parts fully inside their prescribed regions. No extra detached body parts. Soft cozy editorial drawing, no photorealism.

## 背景修正提示词

Use case: background-extraction. Edit this exact sprite sheet. Remove the baked-in gray and white checkerboard completely and replace it with genuine transparent alpha pixels. Preserve the sofa, seated headless body, separate blank head, their exact positions, dimensions, pencil texture, colors and silhouettes. No checkerboard pattern should exist in output RGB. Export actual RGBA transparency, NOT a visualization of transparency. Do not move or redraw the character. No text.
