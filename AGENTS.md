# Claude Code 项目指南

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

## 目录结构

```
src/
├── assets/cover/           # 博客封面母版
├── assets/post-images/     # 文章插图母版（不直接发布）
├── components/
│   ├── astro/              # 静态展示组件
│   ├── ui/                 # React UI 基础组件
│   ├── mobile-header-menu.tsx  # 移动端导航菜单 island
│   ├── photo-wall.tsx          # 照片 Catalog、筛选与 URL 状态
│   ├── photo-lightbox.tsx      # 照片大图浏览
│   ├── search-dialog.tsx       # 搜索对话框
│   └── signature-animation.tsx # 签名动画 island
├── layouts/
│   └── SiteLayout.astro    # 站点布局与 SEO meta
├── lib/
│   ├── astro-posts.ts      # Astro 文章查询与派生数据
│   ├── covers.ts           # 封面稳定查询接口
│   ├── generated/          # 图片生成器写入的纯数据 adapter
│   ├── markdown.ts         # Markdown 纯函数
│   ├── photo-catalog.ts    # 照片 Catalog 领域契约与校验
│   ├── post-images.ts      # 文章插图稳定查询接口
│   ├── post-schema.ts      # frontmatter zod schema 与校验
│   ├── post-tags.ts        # tag 归档分组
│   ├── rehype-blog-content.ts  # 标题锚点、外链、响应式插图
│   ├── seo.ts              # SEO meta 与 JSON-LD
│   ├── search.ts           # 搜索功能
│   └── site.ts             # 站点配置
├── pages/
│   ├── index.astro         # 首页
│   ├── about.astro         # 关于
│   ├── photos.astro        # R2 照片墙
│   ├── projects.astro      # 工具箱
│   ├── posts/[slug].astro  # 文章详情页
│   └── tags/[tag].astro    # tag 归档页
└── content.config.ts       # 内容集合配置
```

## 关键文件

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

### 封面图片

封面多尺寸 WebP 由 `scripts/generate-covers.ts`（sharp）写入 `public/cover/`，生成数据写入 `src/lib/generated/covers.json`；调用方只依赖稳定的 `src/lib/covers.ts` 接口。

## 代码风格

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- UI 组件使用 class-variance-authority 管理样式变体
- 使用 tailwind-merge 合并 className
