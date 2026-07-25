import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { readPublishedPosts } from "./scripts/lib/post-catalog";

// astro build/check 通过 content collection 校验文章，但那条路径不覆盖 vitest。
// 该插件让 `bun run test` 走一遍与构建脚本完全相同的发现与校验逻辑。
function validateBlogContent(): Plugin {
  const postsDir = path.join(process.cwd(), "content", "posts");

  const validate = () => {
    if (fs.existsSync(postsDir)) {
      readPublishedPosts(postsDir);
    }
  };

  return {
    name: "validate-blog-content",
    buildStart() {
      validate();
    },
    configureServer() {
      validate();
    },
  };
}

export default defineConfig({
  plugins: [validateBlogContent()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
