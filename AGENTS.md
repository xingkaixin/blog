# Agent 项目指南

基于 Astro 7 的个人技术博客：静态生成，React islands 负责交互，部署到 Cloudflare Workers。
命令与依赖以 `package.json` 为准，项目概览见 `README.md`。

## 先读

- `CONTEXT.md`：文章、项目与照片的领域术语唯一真源；修改相关领域代码前先读
- `docs/photo-wall.md`：照片发布、删除、回收与迁移流程；执行 `photos:*` 命令前先读
- `src/lib/post-schema.ts`：frontmatter 契约唯一真源，content collection、构建脚本与测试共用
- `src/lib/rehype-blog-content.ts`：正文渲染增强，包括标题锚点、外链属性、插图转响应式 picture

## 文章

文章平铺在 `content/posts/`，不支持子目录，放进子目录会让构建报错。字段以 `post-schema.ts` 为准：

```yaml
---
title: 文章标题
date: "2025-01-01" # 必须加引号
summary: 文章摘要
tags: [tag1, tag2]
cover: agent-friendly-tool.png
coverAlt: 封面图描述
draft: true # 可选，草稿不发布
---
```

- 封面图片放在 `src/assets/cover/`。
- 插图母版放在 `src/assets/post-images/<文章 slug>/`，Markdown 里写
  `/posts/images/<文章 slug>/<文件名>`。

## 生成产物

`public/search-index.json`、`public/cover/`、`public/posts/images/` 和 `src/lib/generated/`
是生成产物。不要直接编辑；修改母版或生成逻辑后运行对应生成命令，并提交结果。
封面与插图数据通过 `src/lib/covers.ts`、`src/lib/post-images.ts` 读取。

`src/assets/fonts/` 也是生成产物，但不在构建中生成：由 `uv run scripts/subset-fonts.py`
按 `dist/` 实际用字手动裁剪。新文章标题出现新汉字等情况需要重跑，见
`docs/site-performance.md` 的字体一节。

## 双语页面

只有首页、工具箱、照片墙和 RSS 页有英文版。新增双语页面要同步三处：

- 页面放在 `src/pages/[...lang]/`，导出 `getStaticPaths = bilingualStaticPaths`
- 路径加入 `src/lib/i18n.ts` 的 `bilingualPaths`
- 中英文案放在 `src/lib/messages/`

## 验证

- `bun run check:source`：快速验证，包括 lint、格式、类型与测试
- `bun run isok`：完整验证门，额外运行生产构建与生成产物一致性检查

## 部署

`bun run deploy` 会修改线上环境，只在用户明确要求时运行。`cf` 由 mise 全局安装，不加为项目依赖。
验证部署产物用 `cf deploy --prebuilt --dry-run`。不要运行 `cf build` 或不带 `--prebuilt` 的
`cf deploy`，它们会跳过本项目的图片、搜索与 Sitemap 构建链。

## UI 约定

- 颜色使用 `src/index.css` 中声明的主题 token。`@shadcn/lint` 不检查 `.astro` 模板和 CSS，这两处需要自己遵守。
- 优先复用 `src/components/ui/` 中已有组件；只有存在真实变体时才使用 class-variance-authority。
- 需要组合条件类名或调用方 `className` 时，复用 `src/lib/utils.ts` 的 `cn()`。
