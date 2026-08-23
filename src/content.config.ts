import { fileURLToPath } from "node:url";
import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { createPostFrontmatterSchema } from "@/lib/post-schema";
import { parsePostSlug } from "@/lib/published-post";

const postFrontmatterSchema = createPostFrontmatterSchema(
  fileURLToPath(new URL("./assets/cover/", import.meta.url)),
);

const posts = defineCollection({
  // 平铺匹配，与 readPublishedPosts 的发现规则保持一致；子目录由后者显式报错拦下。
  loader: glob({
    pattern: "*.md",
    base: "./content/posts",
    generateId: ({ entry }) => parsePostSlug(entry.replace(/\.md$/, ""), "post filename"),
  }),
  schema: postFrontmatterSchema,
});

export const collections = { posts };
