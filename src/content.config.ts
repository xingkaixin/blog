import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { COVER_MISSING_MESSAGE, coverExists, postFrontmatterSchema } from "@/lib/post-schema";

const posts = defineCollection({
  // 平铺匹配，与 readPublishedPosts 的发现规则保持一致；子目录由后者显式报错拦下。
  loader: glob({
    pattern: "*.md",
    base: "./content/posts",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: postFrontmatterSchema.refine(({ cover }) => coverExists(cover), {
    message: COVER_MISSING_MESSAGE,
    path: ["cover"],
  }),
});

export const collections = { posts };
