import { z } from "astro/zod";

export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  summary: z.string().min(1),
  tags: z.array(z.string()),
  cover: z.string().min(1),
  coverAlt: z.string().min(1),
  draft: z.boolean().optional(),
});

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

export type PublishedPost = Omit<PostFrontmatter, "date" | "draft"> & {
  slug: string;
  date: string;
};

export function toDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
