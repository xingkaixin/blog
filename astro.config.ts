import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";
import { rehypeBlogContent } from "./src/lib/rehype-blog-content";
import { siteConfig } from "./src/lib/site";

const configuredPhotoUrl = process.env.PUBLIC_PHOTO_BASE_URL?.trim() || siteConfig.photoUrl;
const photoProxyTarget = configuredPhotoUrl.startsWith("http")
  ? configuredPhotoUrl
  : siteConfig.photoUrl;

export default defineConfig({
  site: siteConfig.url,
  output: "static",
  trailingSlash: "always",
  integrations: [react()],
  markdown: {
    shikiConfig: { theme: "css-variables" },
    processor: unified({ remarkPlugins: [remarkGfm], rehypePlugins: [rehypeBlogContent] }),
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      // 开发服务器通过同源代理隔离远端缓存与跨域配置差异。
      proxy: {
        "/__photos": {
          target: photoProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__photos/, ""),
        },
      },
    },
  },
});
