import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";
import { rehypeBlogContent } from "./src/lib/rehype-blog-content";

export default defineConfig({
  site: "https://xingkaixin.me",
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
      // 照片域名未开 CORS，dev 通过同源代理访问生产 R2 数据
      proxy: {
        "/__photos": {
          target: "https://photos.xingkaixin.me",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__photos/, ""),
        },
      },
    },
  },
});
