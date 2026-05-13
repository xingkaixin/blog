import fs from "node:fs";
import path from "node:path";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

const coverDir = path.join(process.cwd(), "src", "assets", "cover");

const posts = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./content/posts",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    summary: z.string().min(1),
    tags: z.array(z.string()),
    cover: z
      .string()
      .min(1)
      .refine((cover) => {
        return fs.existsSync(path.join(coverDir, path.basename(cover)));
      }, "Cover image not found"),
    coverAlt: z.string().min(1),
    draft: z.boolean().optional(),
  }),
});

export const collections = { posts };
