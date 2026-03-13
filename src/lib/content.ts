export type TocItem = {
  depth: number;
  text: string;
  id: string;
};

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string;
  coverAlt: string;
  readingTime: number;
};

export type PostDetail = PostMeta & {
  content: string;
  plainText: string;
  toc: TocItem[];
};

type Frontmatter = {
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover: string;
  coverAlt: string;
  draft?: boolean;
};

const postModules = import.meta.glob("/content/posts/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

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

type ParsedFrontmatter = {
  data: Partial<Frontmatter>;
  content: string;
};

function splitFrontmatter(source: string): ParsedFrontmatter {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source);

  if (!match) {
    return {
      data: {},
      content: source,
    };
  }

  const [, rawFrontmatter, content] = match;
  const lines = rawFrontmatter.split("\n");
  const data: Partial<Frontmatter> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const keyValueMatch = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!keyValueMatch) {
      continue;
    }

    const [, key, rawValue] = keyValueMatch;

    if (rawValue === "") {
      const items: string[] = [];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const itemMatch = /^\s*-\s+(.*)$/.exec(lines[cursor]);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1].trim());
        cursor += 1;
      }

      data[key as keyof Frontmatter] = items as never;
      index = cursor - 1;
      continue;
    }

    const normalizedValue =
      rawValue === "true" ? true : rawValue === "false" ? false : rawValue.trim();

    data[key as keyof Frontmatter] = normalizedValue as never;
  }

  return { data, content };
}

const removeFrontmatter = (source: string) => splitFrontmatter(source).content;

export function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function extractPlainText(markdown: string) {
  return removeFrontmatter(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractToc(markdown: string): TocItem[] {
  return removeFrontmatter(markdown)
    .split("\n")
    .flatMap((line) => {
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

function estimateReadingTime(text: string) {
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 220));
}

export function parseMarkdownPost(slug: string, source: string): PostDetail | null {
  const { data, content } = splitFrontmatter(source);
  const frontmatter = data as Partial<Frontmatter>;

  if (frontmatter.draft) {
    return null;
  }

  const plainText = extractPlainText(content);
  const toc = extractToc(content);

  return {
    slug,
    title: String(frontmatter.title ?? ""),
    date: String(frontmatter.date ?? ""),
    summary: String(frontmatter.summary ?? ""),
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
    cover: String(frontmatter.cover ?? ""),
    coverAlt: String(frontmatter.coverAlt ?? ""),
    readingTime: estimateReadingTime(plainText),
    content,
    plainText,
    toc,
  };
}

const posts = Object.entries(postModules)
  .map(([filePath, source]) => {
    const slug = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
    return parseMarkdownPost(slug, source);
  })
  .filter((post): post is PostDetail => Boolean(post))
  .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

export function getAllPosts(): PostDetail[] {
  return posts;
}

export function getPostBySlug(slug: string) {
  return posts.find((post) => post.slug === slug);
}

export function getAllTags() {
  return [...new Set(posts.flatMap((post) => post.tags))].sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  );
}
