import { canonicalTag } from "./post-tag";
import { primaryProjectUrl, projects, rankProjects, type Project } from "./projects";
import { postHref, parsePostSlug } from "./published-post";
import { loadSearchIndex, rankPosts, type SearchIndexItem } from "./search";
import { siteConfig } from "./site";
import { parseWebMcpPost } from "./webmcp-post";

const MAX_QUERY_LENGTH = 200;
const MAX_SLUG_LENGTH = 255;
const MAX_TAG_LENGTH = 80;
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 20;
const POST_LICENSE = {
  name: "CC BY-NC-ND 4.0",
  url: "https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh-hans",
} as const;

type ToolExecuteOptions = {
  signal: AbortSignal;
};

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute(input: unknown, options: ToolExecuteOptions): unknown;
};

type WebMcpModelContext = {
  registerTool(tool: WebMcpTool): Promise<void>;
};

type WebMcpDocument = Document & {
  modelContext?: WebMcpModelContext;
};

type SearchPostsInput = {
  query?: string;
  tag?: string;
  year?: string;
  limit: number;
};

const searchPostsTool: WebMcpTool = {
  name: "search_posts",
  title: "搜索博客文章",
  description:
    "Search published blog posts by text, exact tag, and year. Returns metadata and canonical URLs without changing the page.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", maxLength: MAX_QUERY_LENGTH },
      tag: { type: "string", maxLength: MAX_TAG_LENGTH },
      year: { type: "string", pattern: "^[0-9]{4}$" },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_SEARCH_LIMIT,
        default: DEFAULT_SEARCH_LIMIT,
      },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input) {
    const params = parseSearchPostsInput(input);
    const posts = await loadSearchIndex();
    const matches = matchingPosts(posts, params);

    return {
      total: matches.length,
      posts: matches.slice(0, params.limit).map(postForAgent),
    };
  },
};

const getPostTool: WebMcpTool = {
  name: "get_post",
  title: "读取博客文章",
  description:
    "Read one published blog post by slug. Returns the original Markdown and metadata as source material.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        maxLength: MAX_SLUG_LENGTH,
        pattern: "^[A-Za-z0-9_-]+$",
      },
    },
    required: ["slug"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute(input, { signal }) {
    const slug = parsePostSlug(requiredString(input, "slug", MAX_SLUG_LENGTH), "slug");
    const response = await fetch(`/webmcp/posts/${encodeURIComponent(slug)}.json`, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to load post ${slug}: ${response.status}`);
    }

    const post = parseWebMcpPost(await response.json());
    if (post.slug !== slug) {
      throw new Error(`Loaded post slug ${post.slug} does not match ${slug}`);
    }

    return {
      ...post,
      author: siteConfig.author,
      url: `${siteConfig.url}${postHref(post.slug)}`,
      contentType: "text/markdown",
      license: POST_LICENSE,
    };
  },
};

const listProjectsTool: WebMcpTool = {
  name: "list_projects",
  title: "查看作者项目",
  description: "List software projects published by the blog author, optionally filtered by text.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", maxLength: MAX_QUERY_LENGTH },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute(input) {
    const query = optionalString(input, "query", MAX_QUERY_LENGTH) ?? "";
    const matches = rankProjects(projects, query);
    return {
      total: matches.length,
      projects: matches.map(projectForAgent),
    };
  },
};

const blogTools = [searchPostsTool, getPostTool, listProjectsTool];

export async function registerBlogWebMcpTools(target: Document): Promise<void> {
  const modelContext = (target as WebMcpDocument).modelContext;
  if (!modelContext) {
    return;
  }

  await Promise.all(blogTools.map((tool) => modelContext.registerTool(tool)));
}

function parseSearchPostsInput(input: unknown): SearchPostsInput {
  const query = optionalString(input, "query", MAX_QUERY_LENGTH);
  const tag = optionalString(input, "tag", MAX_TAG_LENGTH);
  const year = optionalString(input, "year", 4);
  if (year && !/^[0-9]{4}$/.test(year)) {
    throw new Error("year must be a four-digit year");
  }

  return {
    query,
    tag: tag ? canonicalTag(tag) : undefined,
    year,
    limit: optionalLimit(input),
  };
}

function matchingPosts(posts: SearchIndexItem[], input: SearchPostsInput): SearchIndexItem[] {
  const ranked = input.query ? rankPosts(posts, { query: input.query }) : posts;
  return ranked.filter(
    (post) =>
      (!input.tag || post.tags.some((tag) => canonicalTag(tag) === input.tag)) &&
      (!input.year || post.date.startsWith(input.year)),
  );
}

function postForAgent(post: SearchIndexItem) {
  return {
    ...post,
    url: `${siteConfig.url}${postHref(post.slug)}`,
  };
}

function projectForAgent(project: Project) {
  return {
    id: project.id,
    name: project.name,
    kind: project.kind,
    description: project.description,
    tags: project.tags,
    links: (project.links ?? [{ label: "网站", url: primaryProjectUrl(project) }]).map(
      ({ label, url }) => ({ label, url }),
    ),
  };
}

function inputRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("tool input must be an object");
  }
  return input as Record<string, unknown>;
}

function requiredString(input: unknown, field: string, maximumLength: number): string {
  const value = inputRecord(input)[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (value.length > maximumLength) {
    throw new Error(`${field} must not exceed ${maximumLength} characters`);
  }
  return value;
}

function optionalString(input: unknown, field: string, maximumLength: number): string | undefined {
  const value = inputRecord(input)[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    throw new Error(`${field} must not exceed ${maximumLength} characters`);
  }
  return normalized || undefined;
}

function optionalLimit(input: unknown): number {
  const value = inputRecord(input).limit;
  if (value === undefined) {
    return DEFAULT_SEARCH_LIMIT;
  }
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 1 ||
    (value as number) > MAX_SEARCH_LIMIT
  ) {
    throw new Error(`limit must be an integer between 1 and ${MAX_SEARCH_LIMIT}`);
  }
  return value as number;
}
