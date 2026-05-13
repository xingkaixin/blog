# Claude Code 项目指南

## 项目简介

这是一个基于 Astro + TypeScript 的个人技术博客，使用 Markdown 文件作为文章存储格式。

## 技术栈

- **Astro 6** + **TypeScript** - 站点框架与静态生成
- **React 19** - 交互组件 islands
- **Tailwind CSS 4** - 样式方案
- **Astro Content Collections** - Markdown 内容管理
- **remark-gfm** + 自定义 rehype 插件 - Markdown 渲染增强
- **Radix UI** - UI 组件库
- **Vitest** - 测试框架

## 目录结构

```
src/
├── assets/cover/           # 博客封面图片
├── components/
│   ├── astro/              # 静态展示组件
│   ├── ui/                 # 基础 UI 组件 (button, input, dialog 等)
│   ├── search-dialog.tsx       # 搜索对话框
│   └── signature-animation.tsx # 签名动画 island
├── layouts/
│   └── SiteLayout.astro    # 站点布局与 SEO meta
├── lib/
│   ├── astro-posts.ts      # Astro 文章查询与派生数据
│   ├── content.ts          # 文章加载与处理
│   ├── markdown.ts         # Markdown 纯函数
│   ├── seo.ts              # SEO meta 与 JSON-LD
│   ├── search.ts           # 搜索功能
│   ├── site.ts             # 站点配置
│   ├── toc-active.ts       # 目录高亮逻辑
│   └── utils.ts            # 工具函数
├── pages/
│   ├── index.astro         # 首页
│   ├── projects.astro      # 工具箱
│   └── posts/[slug].astro  # 文章详情页
└── content.config.ts       # 内容集合配置
```

## 关键文件

- `src/lib/site.ts` - 站点配置 (标题、描述、作者)
- `src/content.config.ts` - 文章 frontmatter schema 与封面校验
- `src/pages/posts/[slug].astro` - 文章页静态生成
- `src/lib/seo.ts` - 页面 meta 与 JSON-LD
- `astro.config.ts` - Astro、React island、Tailwind 与 Markdown 插件配置
- `content/posts/` - 博客文章目录，每篇文章为独立 .md 文件

## 开发注意事项

### 文章格式

博客文章使用 Markdown 格式，文件放在 `content/posts/` 目录。每篇文章必须包含以下 frontmatter：

```yaml
---
title: 文章标题
date: 2025-01-01
summary: 文章摘要
tags: [tag1, tag2]
cover: cover-image.jpg
coverAlt: 封面图描述
---
```

封面图片放在 `src/assets/cover/` 目录。

### 构建命令

```bash
bun run dev      # 开发服务器
bun run build    # 构建生产版本 (含封面图生成)
bun run test     # 运行测试
bun run lint     # 代码检查
```

### 封面图片

使用 `vite-imagetools` 自动生成响应式封面图片，通过 `scripts/generate-covers.ts` 脚本处理。

## 代码风格

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- UI 组件使用 class-variance-authority 管理样式变体
- 使用 tailwind-merge 合并 className
