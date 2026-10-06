# 行开心的颠倒世界

个人技术博客，基于 Astro + TypeScript 构建，使用 Markdown 文件作为文章存储格式。

## 技术栈

- **站点框架**: Astro 7 + TypeScript
- **交互组件**: React 19 islands
- **样式方案**: Tailwind CSS 4
- **内容管理**: Astro Content Collections + Markdown
- **Markdown**: Astro 内置 GFM + 自定义 rehype 插件
- **UI 组件**: Base UI
- **测试**: Vitest
- **包管理**: Bun

## 目录结构

```
├── content/posts/          # 博客文章 (Markdown 格式)
├── public/                # 静态资源
├── scripts/                # 构建脚本
├── src/
│   ├── assets/            # 非公开图片母版（封面与文章插图）
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
- RSS 订阅与 Tag 归档
- 目录自动提取与导航
- 阅读进度指示器
- SEO meta、OG 与 JSON-LD 静态生成
- R2 照片墙、相册筛选与 HEIC 发布流程

## 快速开始

项目使用 mise 和 `mise.lock` 固定 Bun 1.4.0，CI 从 `package.json` 读取同一版本。

```bash
# 安装固定版本的 Bun
mise install

# 安装依赖
bun install

# 开发模式
bun run dev
```

## 常用命令

```bash
bun run isok          # 完整验证：源码检查、测试、生产构建与生成数据一致性
bun run check:source  # 快速验证：lint、格式、类型与测试
bun run build         # 构建 dist/（含搜索、图片、OG、Feed 与 sitemap）
bun run preview       # 本地预览生产构建
bun run test          # 运行测试
bun run lint          # 代码检查
bun run typecheck     # Astro 与 TypeScript 类型检查
bun run format        # 自动格式化
bun run format:check  # 仅检查格式
bun run photos:publish -- <照片或目录...>  # 发布照片到 R2
bun run photos:delete -- <照片或目录...> --confirm  # 从 R2 移除照片
bun run photos:gc -- --confirm  # 回收超过缓存宽限期的照片对象
```

照片存储、CORS、本地预览与发布参数见
[照片墙文档](docs/photo-wall.md)。

文章插图母版放在 `src/assets/post-images/<文章 slug>/`，Markdown 仍使用
`/posts/images/<文章 slug>/<文件名>`。构建只会把响应式 WebP 写入
`public/posts/images/`，不会公开母版。

## 部署

默认部署目标是 Cloudflare Workers。使用 mise 全局安装的 `cf`（已验证
`1.0.0-beta.12`），不将 CLI 安装为项目依赖。完成 `cf auth login` 后运行：

```bash
bun run deploy
```

该命令先验证照片目录、执行完整构建，再通过 `cf deploy --prebuilt` 发布到 `blog` Worker。
`cloudflare.config.ts` 管理 Worker 配置；`scripts/build-worker.ts` 使用 Bun 打包
`src/worker.ts`，将 `dist/` 和 Worker 写入 `.cloudflare/output/v0/`。
`dist/` 仍是纯静态产物，Worker 负责 HTML／Markdown 内容协商与发现响应头。

正式域名为 `xingkaixin.me`、`www.xingkaixin.me` 和 `blog.xingkaixin.me`；
`www` 到主域名的重定向继续由 Cloudflare 域名规则处理；Worker 也会将其他非主域名请求
301 到主域名（`runWorkerFirst` 排除的静态资源除外）。
`workers.dev` 主地址和版本预览地址均已关闭，部署后使用正式域名验证。R2 的 CORS 仅允许正式主域名，
因此照片墙交互需在 `https://xingkaixin.me/photos/` 验证。
原 Pages `blog` 项目及历史部署已删除，后续发布只使用 Workers。

构建后可执行 `cf deploy --prebuilt --dry-run` 验证部署产物，不上传或修改线上环境。
不要直接运行 `cf build` 或不带 `--prebuilt` 的 `cf deploy`：它们不会执行本项目完整的
图片、搜索和 Sitemap 构建链。升级全局 `cf` 后应重新执行 dry run，确认 Build Output 兼容。

## License

MIT License - 详见 [LICENSE](LICENSE) 文件
