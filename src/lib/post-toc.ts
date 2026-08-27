export type TocItem = {
  depth: number;
  text: string;
  id: string;
};

type RenderedHeading = {
  depth: number;
  text: string;
  slug: string;
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

export function createHeadingIdAllocator() {
  const counts = new Map<string, number>();

  return (text: string) => {
    const baseId = buildHeadingId(text) || "section";
    let id = baseId;
    while (counts.has(id)) {
      const count = (counts.get(baseId) ?? 1) + 1;
      counts.set(baseId, count);
      id = `${baseId}-${count}`;
    }
    counts.set(id, 1);
    return id;
  };
}

export function tocFromHeadings(headings: RenderedHeading[]): TocItem[] {
  return headings.flatMap(({ depth, text, slug }) => {
    if (depth !== 2 && depth !== 3) {
      return [];
    }
    return [{ depth, id: slug, text }];
  });
}
