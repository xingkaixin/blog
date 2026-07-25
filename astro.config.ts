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
  },
});
