import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { COVER_MISSING_MESSAGE, coverExists, postFrontmatterSchema } from "@/lib/post-schema";

const posts = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./content/posts",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: postFrontmatterSchema.refine(({ cover }) => coverExists(cover), {
    message: COVER_MISSING_MESSAGE,
    path: ["cover"],
  }),
});

export const collections = { posts };
