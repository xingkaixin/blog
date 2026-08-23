export type TocItem = {
  depth: number;
  text: string;
  id: string;
};

type RenderedHeading = {
  depth: number;
  text: string;
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
    const count = (counts.get(baseId) ?? 0) + 1;
    counts.set(baseId, count);
    return count === 1 ? baseId : `${baseId}-${count}`;
  };
}

export function tocFromHeadings(headings: RenderedHeading[]): TocItem[] {
  const allocateId = createHeadingIdAllocator();

  return headings.flatMap(({ depth, text }) => {
    const id = allocateId(text);
    if (depth !== 2 && depth !== 3) {
      return [];
    }
    return [{ depth, id, text }];
  });
}
