import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSearchCache, type SearchIndexItem } from "./search";
import { siteConfig } from "./site";
import { registerBlogWebMcpTools } from "./webmcp";

type CapturedTool = {
  name: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute(input: unknown, options: { signal: AbortSignal }): unknown;
};

const posts: SearchIndexItem[] = [
  {
    slug: "agent-tools",
    title: "Agent 工具设计",
    date: "2026-08-26",
    summary: "关于 Agent 和工具契约。",
    tags: ["AI", "Agent"],
  },
  {
    slug: "reading-notes",
    title: "阅读笔记",
    date: "2025-01-02",
    summary: "长期阅读记录。",
    tags: ["阅读"],
  },
];

describe("blog WebMCP tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetSearchCache();
  });

  it("does nothing when the browser does not support WebMCP", async () => {
    await expect(registerBlogWebMcpTools({} as Document)).resolves.toBeUndefined();
  });

  it("registers three read-only tools", async () => {
    const tools = await registeredTools();

    expect([...tools.keys()]).toEqual(["search_posts", "get_post", "list_projects"]);
    expect([...tools.values()].every((tool) => tool.annotations.readOnlyHint)).toBe(true);
    expect(tools.get("get_post")?.annotations.untrustedContentHint).toBe(true);
  });

  it("searches posts by text, tag, and year", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => posts,
    } as Response);
    const tool = requiredTool(await registeredTools(), "search_posts");

    await expect(
      tool.execute(
        { query: "Agent", tag: "AI", year: "2026", limit: 1 },
        { signal: new AbortController().signal },
      ),
    ).resolves.toEqual({
      total: 1,
      posts: [
        {
          ...posts[0],
          url: `${siteConfig.url}/posts/agent-tools/`,
        },
      ],
    });
  });

  it("reads post Markdown through its static endpoint", async () => {
    const signal = new AbortController().signal;
    const fetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ...posts[0], content: "# Agent 工具设计\n" }),
    } as Response);
    const tool = requiredTool(await registeredTools(), "get_post");

    await expect(tool.execute({ slug: "agent-tools" }, { signal })).resolves.toMatchObject({
      ...posts[0],
      content: "# Agent 工具设计\n",
      contentType: "text/markdown",
      url: `${siteConfig.url}/posts/agent-tools/`,
    });
    expect(fetch).toHaveBeenCalledWith("/webmcp/posts/agent-tools.json", {
      headers: { Accept: "application/json" },
      signal,
    });
  });

  it("filters the author's projects", async () => {
    const tool = requiredTool(await registeredTools(), "list_projects");
    const result = await tool.execute({ query: "语音" }, { signal: new AbortController().signal });

    expect(result).toMatchObject({
      total: 1,
      projects: [{ id: "voicen", name: "Voicen" }],
    });
  });

  it("rejects invalid tool input", async () => {
    const tools = await registeredTools();
    const options = { signal: new AbortController().signal };

    await expect(
      requiredTool(tools, "search_posts").execute({ limit: 21 }, options),
    ).rejects.toThrow("limit");
    await expect(
      requiredTool(tools, "get_post").execute({ slug: "two words" }, options),
    ).rejects.toThrow("slug");
  });
});

async function registeredTools(): Promise<Map<string, CapturedTool>> {
  const tools = new Map<string, CapturedTool>();
  const target = {
    modelContext: {
      registerTool: async (tool: CapturedTool) => {
        tools.set(tool.name, tool);
      },
    },
  } as unknown as Document;

  await registerBlogWebMcpTools(target);
  return tools;
}

function requiredTool(tools: Map<string, CapturedTool>, name: string): CapturedTool {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return tool;
}
