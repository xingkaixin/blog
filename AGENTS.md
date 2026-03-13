# Claude Code 项目指南

## 项目简介

这是一个基于 React + TypeScript + Vite 的个人技术博客，使用 Markdown 文件作为文章存储格式。

## 技术栈

- **React 19** + **TypeScript** - 前端框架
- **Vite 7** - 构建工具
- **Tailwind CSS 4** - 样式方案
- **React Router DOM 7** - 路由管理
- **react-markdown** - Markdown 渲染
- **Radix UI** - UI 组件库
- **Vitest** - 测试框架

## 目录结构

```
src/
├── assets/cover/           # 博客封面图片
├── components/
│   ├── ui/                 # 基础 UI 组件 (button, input, dialog 等)
│   ├── markdown-renderer.tsx   # Markdown 渲染器
│   ├── post-card.tsx           # 文章卡片组件
│   ├── post-list.tsx           # 文章列表
│   ├── search-dialog.tsx       # 搜索对话框
│   ├── site-layout.tsx         # 站点布局
│   ├── tag-filter.tsx          # 标签过滤
│   └── toc-nav.tsx             # 目录导航
├── lib/
│   ├── content.ts          # 文章加载与处理
│   ├── search.ts           # 搜索功能
│   ├── site.ts             # 站点配置
│   ├── toc-active.ts       # 目录高亮逻辑
│   └── utils.ts            # 工具函数
├── routes/
│   └── post-page.tsx       # 文章详情页
├── test/                   # 测试配置
└── App.tsx                 # 应用入口
```

## 关键文件

- `src/lib/site.ts` - 站点配置 (标题、描述、作者)
- `src/lib/content.ts` - 文章加载逻辑，使用 gray-matter 解析 Markdown
- `vite.config.ts` - Vite 配置，包含博客内容验证插件
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
