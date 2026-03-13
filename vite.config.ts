import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { imagetools } from "vite-imagetools";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

const requiredFrontmatter = [
  "title",
  "date",
  "summary",
  "tags",
  "cover",
  "coverAlt",
] as const;

function validateBlogContent(): Plugin {
  const root = process.cwd();
  const postsDir = path.join(root, "content", "posts");

  const validate = () => {
    if (!fs.existsSync(postsDir)) {
      return;
    }

    const seenSlugs = new Set<string>();
    const files = fs.readdirSync(postsDir).filter((file) => file.endsWith(".md"));

    for (const file of files) {
      const slug = file.replace(/\.md$/, "");

      if (seenSlugs.has(slug)) {
        throw new Error(`Duplicate post slug detected: ${slug}`);
      }
      seenSlugs.add(slug);

      const absolutePath = path.join(postsDir, file);
      const source = fs.readFileSync(absolutePath, "utf8");
      const { data } = matter(source);

      for (const field of requiredFrontmatter) {
        if (data[field] == null || data[field] === "") {
          throw new Error(`Missing frontmatter "${field}" in ${file}`);
        }
      }

      if (!Array.isArray(data.tags) || data.tags.some((item) => typeof item !== "string")) {
        throw new Error(`Frontmatter "tags" must be a string array in ${file}`);
      }

      if (typeof data.cover !== "string") {
        throw new Error(`Frontmatter "cover" must be a string in ${file}`);
      }

      const coverPath = path.join(root, "public", "posts", "cover", path.basename(data.cover));
      if (!fs.existsSync(coverPath)) {
        throw new Error(`Cover image not found for ${file}: ${data.cover}`);
      }
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
  plugins: [imagetools(), react(), tailwindcss(), validateBlogContent()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
