import fs from "node:fs";
import path from "node:path";
import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { postFrontmatterSchema } from "@/lib/post-schema";

const coverDir = path.join(process.cwd(), "src", "assets", "cover");

const posts = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./content/posts",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: postFrontmatterSchema.refine(
    ({ cover }) => fs.existsSync(path.join(coverDir, path.basename(cover))),
    { message: "Cover image not found", path: ["cover"] },
  ),
});

export const collections = { posts };
