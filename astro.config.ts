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
  build: {
    inlineStylesheets: "always",
  },
  prefetch: {
    defaultStrategy: "hover",
  },
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
    plugins: [
      tailwindcss(),
      photoPreviewPlugin(previewDirectory),
      {
        name: "client-chunk-consolidation",
        configEnvironment(name) {
          if (name !== "client") {
            return undefined;
          }
          return {
            build: {
              rolldownOptions: {
                output: {
                  codeSplitting: {
                    groups: [
                      {
                        name: "site-shell",
                        test: /src\/lib\/(?:site-shell|site-shortcuts|holiday-logo-browser|holiday-logo-lookup|search-launcher|site|stamps|published-post|i18n|site-events|day-part|analytics|smart-header|post-transition|skip-to-content|article-engagement|post-console)\.ts|config\/holiday-logos\.json/,
                        priority: 20,
                      },
                      {
                        name: "astro-router",
                        test: /astro\/dist\/(?:transitions|prefetch)/,
                        priority: 15,
                      },
                      {
                        name: "react-vendor",
                        test: /node_modules\/(?:react|react-dom|scheduler)\//,
                        priority: 10,
                      },
                    ],
                  },
                },
              },
            },
          };
        },
      },
    ],
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
