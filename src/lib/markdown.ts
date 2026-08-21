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

export type ReadingMetrics = {
  wordCount: number;
  readingMinutes: number;
};

export function estimateReadingMetrics(markdown: string): ReadingMetrics {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ");
  const hanCharacters = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latinWords = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0;
  const wordCount = hanCharacters + latinWords;
  const readingMinutes = Math.max(1, Math.ceil(hanCharacters / 400 + latinWords / 220));

  return { wordCount, readingMinutes };
}

// frontmatter 的 date 是日历日期，解析后锚在 UTC 午夜。不指定 timeZone 会按运行时
// 本地时区渲染，在 UTC 负偏移的机器上构建会让全站日期早一天。
export function formatDisplayDate(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
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
