import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import { agentMarkdown } from "@iannuttall/seo-graph-astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { photoPreviewPlugin } from "./scripts/lib/photo-preview";
import { rehypeBlogContent } from "./src/lib/rehype-blog-content";
import { siteConfig } from "./src/lib/site";

const configuredPhotoUrl = process.env.PUBLIC_PHOTO_BASE_URL?.trim() || siteConfig.photoUrl;
const previewDirectory = process.env.PHOTO_PREVIEW_DIRECTORY?.trim();
const photoProxyTarget = configuredPhotoUrl.startsWith("http")
  ? configuredPhotoUrl
  : siteConfig.photoUrl;

export default defineConfig({
  site: siteConfig.url,
  output: "static",
  trailingSlash: "always",
  integrations: [
    react(),
    agentMarkdown({
      cloudflareHeaders: false,
      llmsTxt: { title: siteConfig.title, summary: siteConfig.description },
      routeMigrationWarnings: false,
    }),
  ],
  markdown: {
    shikiConfig: { theme: "css-variables" },
    processor: unified({ rehypePlugins: [rehypeBlogContent] }),
  },
  vite: {
    plugins: [tailwindcss(), photoPreviewPlugin(previewDirectory)],
    build: {
      // 字体保持独立文件，才能按 unicode-range 按需下载并被预加载；小于 4 KB 的子集默认会被内联进 CSS。
      assetsInlineLimit: (file) => (file.endsWith(".woff2") ? false : undefined),
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      // 开发服务器通过同源代理隔离远端缓存与跨域配置差异。
      proxy: previewDirectory
        ? undefined
        : {
            "/__photos": {
              target: photoProxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/__photos/, ""),
            },
          },
    },
  },
});
