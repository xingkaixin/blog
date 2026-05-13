# 行开心的颠倒世界

个人技术博客，基于 Astro + TypeScript 构建，使用 Markdown 文件作为文章存储格式。

## 技术栈

- **站点框架**: Astro 6 + TypeScript
- **交互组件**: React 19 islands
- **样式方案**: Tailwind CSS 4
- **内容管理**: Astro Content Collections + Markdown
- **Markdown**: remark-gfm + 自定义 rehype 插件
- **UI 组件**: Radix UI
- **测试**: Vitest
- **包管理**: Bun

## 目录结构

```
├── content/posts/          # 博客文章 (Markdown 格式)
├── public/                # 静态资源
├── scripts/                # 构建脚本
├── src/
│   ├── assets/            # 图片资源 (封面图)
│   ├── components/         # Astro 组件与 React islands
│   │   ├── astro/          # 静态展示组件
│   │   └── ui/             # React UI 基础组件
│   ├── layouts/            # Astro 布局
│   ├── lib/                # 工具函数和业务逻辑
│   └── pages/              # Astro 文件路由
├── astro.config.ts         # Astro 配置
├── src/content.config.ts   # 内容集合配置
└── package.json             # 项目依赖
```

## 主要功能

- Markdown 博客文章渲染，支持 GFM 语法
- 响应式封面图片生成
- 文章搜索
- 目录自动提取与导航
- 阅读进度指示器
- SEO meta、OG 与 JSON-LD 静态生成

## 快速开始

```bash
# 安装依赖
bun install

# 开发模式
bun run dev

# 构建生产版本
bun run build

# 运行测试
bun run test

# 代码检查
bun run lint

# 本地预览
bun run preview
```

## 部署

项目构建产物位于 `dist/` 目录，可直接部署到 Vercel、Netlify 等静态托管平台。

## License

MIT License - 详见 [LICENSE](LICENSE) 文件
