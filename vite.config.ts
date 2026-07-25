import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { parseFrontmatter } from "./src/lib/post-schema";

// astro build/check 通过 content collection 校验文章，但那条路径不覆盖 vitest。
// 该插件让 `bun run test` 同样能拦住坏 frontmatter，并补上 collection 没有的 slug 去重。
function validateBlogContent(): Plugin {
  const postsDir = path.join(process.cwd(), "content", "posts");

  const validate = () => {
    if (!fs.existsSync(postsDir)) {
      return;
    }

    const seenSlugs = new Set<string>();

    for (const file of fs.readdirSync(postsDir).filter((entry) => entry.endsWith(".md"))) {
      const slug = file.replace(/\.md$/, "");

      if (seenSlugs.has(slug)) {
        throw new Error(`Duplicate post slug detected: ${slug}`);
      }
      seenSlugs.add(slug);

      parseFrontmatter(slug, matter(fs.readFileSync(path.join(postsDir, file), "utf8")).data);
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
