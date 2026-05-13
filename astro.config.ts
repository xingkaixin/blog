import { fileURLToPath } from "node:url";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";
import { imagetools } from "vite-imagetools";
import { rehypeBlogContent } from "./src/lib/rehype-blog-content";

function resolveManualChunk(id: string) {
  if (id.includes("remark-gfm")) {
    return "markdown";
  }

  if (id.includes("@radix-ui/react-dialog") || id.includes("@radix-ui/react-icons")) {
    return "radix-ui";
  }

  if (id.includes("@fontsource/jetbrains-mono") || id.includes("@fontsource/outfit")) {
    return "font-source";
  }

  return undefined;
}

export default defineConfig({
  site: "https://xingkaixin.me",
  output: "static",
  integrations: [react()],
  markdown: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeBlogContent],
  },
  vite: {
    plugins: [imagetools(), tailwindcss()],
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
