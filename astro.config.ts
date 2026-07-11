import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";
import { rehypeBlogContent } from "./src/lib/rehype-blog-content";

function resolveManualChunk(id: string) {
  if (id.includes("remark-gfm")) {
    return "markdown";
  }

  if (id.includes("@base-ui/react")) {
    return "base-ui";
  }

  if (id.includes("@fontsource/jetbrains-mono") || id.includes("@fontsource/outfit")) {
    return "font-source";
  }

  return undefined;
}

export default defineConfig({
  site: "https://xingkaixin.me",
  output: "static",
  trailingSlash: "always",
  integrations: [react()],
  markdown: {
    processor: unified({ remarkPlugins: [remarkGfm], rehypePlugins: [rehypeBlogContent] }),
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: resolveManualChunk,
        },
      },
    },
  },
});
