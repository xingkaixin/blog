# Agent 项目指南

## 项目简介

这是一个基于 Astro + TypeScript 的个人技术博客，使用 Markdown 文件作为文章存储格式。

## 技术栈

- **Astro 7** + **TypeScript** - 站点框架与静态生成
- **React 19** - 交互组件 islands
- **Tailwind CSS 4** - 样式方案
- **Astro Content Collections** - Markdown 内容管理
- **remark-gfm** + 自定义 rehype 插件 - Markdown 渲染增强
- **Base UI** - UI 组件库
- **Vitest** - 测试框架

## 目录导航

- `content/posts/`：平铺存放 Markdown 文章
- `src/pages/`：Astro 文件路由
- `src/components/`、`src/hooks/`：Astro 展示组件与 React islands
- `src/lib/`：领域契约、查询、渲染与 SEO 逻辑
- `scripts/`：构建、校验与照片发布工具
- `src/assets/`：封面、文章插图与项目资源母版
- `public/`、`src/lib/generated/`：生成产物，以生成脚本为准

## 关键文件

- `package.json` - 命令、依赖与工具版本的唯一真源
- `CONTEXT.md` - 文章、项目与照片领域术语的唯一真源；修改相关领域代码时先阅读
- `docs/photo-wall.md` - 照片发布、删除、回收与迁移流程；执行相关命令前先阅读
- `src/lib/site.ts` - 站点配置 (标题、描述、作者)
- `src/lib/post-schema.ts` - frontmatter 契约唯一真源，被 content collection、构建脚本与 vite 校验插件共用
- `src/content.config.ts` - 内容集合装配（loader + schema）
- `src/lib/rehype-blog-content.ts` - 正文渲染增强：标题锚点、外链属性、插图转响应式 picture
- `src/pages/posts/[slug].astro` - 文章页静态生成
- `src/lib/seo.ts` - 页面 meta 与 JSON-LD
- `astro.config.ts` - Astro、React island、Tailwind 与 Markdown 插件配置
- `content/posts/` - 博客文章目录，每篇文章为独立 .md 文件

## 开发注意事项

### 文章格式

博客文章使用 Markdown 格式，文件平铺放在 `content/posts/` 目录（不支持子目录，放进子目录会让构建报错）。每篇文章必须包含以下 frontmatter：

```yaml
---
title: 文章标题
date: "2025-01-01"
summary: 文章摘要
tags: [tag1, tag2]
cover: agent-friendly-tool.png
coverAlt: 封面图描述
---
```

封面图片放在 `src/assets/cover/` 目录。

文章插图母版放在 `src/assets/post-images/<文章 slug>/`。Markdown URL 继续写成
`/posts/images/<文章 slug>/<文件名>`；生成器只将响应式 WebP 写入 `public/`。

`public/search-index.json`、`public/cover/`、`public/posts/images/` 和
`src/lib/generated/` 是生成产物。不要直接编辑；修改母版或生成逻辑后运行对应生成命令。

### 构建命令

```bash
bun run dev           # 开发服务器
bun run build         # 完整生产构建
bun run isok          # 完整验证门：源码检查、测试、生产构建与生成数据一致性
bun run check:source  # 快速验证：lint、格式、类型与测试
bun run test          # 运行测试
bun run lint          # 代码检查
bun run typecheck     # Astro 与 TypeScript 类型检查
bun run format        # 自动格式化
bun run format:check  # 仅检查格式
bun run deploy        # 构建并部署到 Cloudflare Pages
```

`bun run deploy` 会修改线上环境，只在用户明确要求部署时运行。

### 封面图片

封面多尺寸 WebP 由 `scripts/generate-covers.ts`（Bun.Image）写入 `public/cover/`，生成数据写入 `src/lib/generated/covers.json`；调用方只依赖稳定的 `src/lib/covers.ts` 接口。

## 代码风格

- React islands 使用函数组件与 Hooks
- 优先复用 `src/components/ui/` 中已有组件
- 只有存在真实变体时才使用 class-variance-authority
- 需要组合条件类名或调用方 `className` 时，复用 `src/lib/utils.ts` 的 `cn()`
