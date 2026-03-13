# 行开心的颠倒世界

个人技术博客，基于 React + TypeScript + Vite 构建。

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **样式方案**: Tailwind CSS 4
- **路由**: React Router DOM 7
- **Markdown**: react-markdown + remark-gfm + rehype-slug
- **UI 组件**: Radix UI
- **测试**: Vitest + React Testing Library
- **包管理**: Bun

## 目录结构

```
├── content/posts/          # 博客文章 (Markdown 格式)
├── public/                # 静态资源
├── scripts/                # 构建脚本
├── src/
│   ├── assets/            # 图片资源 (封面图)
│   ├── components/         # React 组件
│   │   └── ui/             # UI 基础组件
│   ├── lib/                # 工具函数和业务逻辑
│   ├── routes/             # 页面路由组件
│   ├── test/               # 测试配置
│   ├── App.tsx             # 应用入口
│   └── main.tsx            # 渲染入口
├── index.html              # HTML 模板
├── vite.config.ts          # Vite 配置
└── package.json             # 项目依赖
```

## 主要功能

- Markdown 博客文章渲染，支持 GFM 语法
- 响应式封面图片生成
- 文章标签过滤与搜索
- 目录自动提取与导航
- 阅读进度指示器
- 深色/浅色主题支持

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
