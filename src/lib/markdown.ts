export type TocItem = {
  depth: number;
  text: string;
  id: string;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export function normalizeHeadingText(value: string) {
  return value
    .replace(/[*_`]/g, "")
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function buildHeadingId(value: string) {
  return slugify(normalizeHeadingText(value));
}

export const removeFrontmatter = (source: string) => {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source);
  return match ? match[2] : source;
};

export function formatDisplayDate(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function extractToc(markdown: string): TocItem[] {
  let isInsideFence = false;

  return removeFrontmatter(markdown)
    .split("\n")
    .flatMap((line) => {
      if (/^\s*```/.test(line)) {
        isInsideFence = !isInsideFence;
        return [];
      }

      if (isInsideFence) {
        return [];
      }

      const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
      if (!match) {
        return [];
      }

      const text = normalizeHeadingText(match[2]);
      return [
        {
          depth: match[1].length,
          text,
          id: buildHeadingId(text),
        },
      ];
    });
}
