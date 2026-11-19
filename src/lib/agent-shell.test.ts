import { describe, expect, it, vi } from "vitest";
import {
  completeShellInput,
  executeShellCommand,
  type ShellDeps,
  type ShellLine,
} from "./agent-shell";
import type { SearchIndexItem } from "./search";

const samplePosts: SearchIndexItem[] = [
  {
    slug: "agent-harness-not-model",
    title: "Agent Harness，而不是模型本身",
    date: "2026-04-12",
    summary: "真正拉开差距的是 Harness。",
    tags: ["AI编程", "Agent"],
  },
  {
    slug: "2026-chiangmai-trip",
    title: "2026 清迈之旅：在有风的地方慢慢走",
    date: "2026-04-28",
    summary: "在清迈慢下来的七天。",
    tags: ["旅行", "生活"],
  },
];

function createDeps(overrides: Partial<ShellDeps> = {}): ShellDeps {
  return {
    loadPosts: async () => samplePosts,
    listTools: () => [
      {
        name: "search_posts",
        title: "搜索博客文章",
        description: "Search published blog posts.",
        inputSchema: { type: "object", properties: { query: { type: "string" } } },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
      },
      {
        name: "get_post",
        title: "读取博客文章",
        description: "Read one published blog post by slug.",
        inputSchema: {
          type: "object",
          properties: { slug: { type: "string" } },
          required: ["slug"],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
      },
      {
        name: "list_projects",
        title: "查看作者项目",
        description: "List software projects.",
        inputSchema: { type: "object", properties: { query: { type: "string" } } },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
      },
    ],
    invokeTool: vi.fn(async (name, input) => {
      if (name === "get_post") {
        return {
          ...samplePosts[0],
          content: "# Harness\n\nTool boundaries matter.\n",
          contentType: "text/markdown",
          url: "https://xingkaixin.me/posts/agent-harness-not-model/",
        };
      }
      return { tool: name, input, total: 1 };
    }),
    readStamps: () => ({ arrival: "2026-04-01" }),
    collectShellStamp: vi.fn(() => true),
    random: () => 0.1,
    ...overrides,
  };
}

function textOf(lines: ShellLine[]): string {
  return lines.map((line) => line.segments.map((segment) => segment.text).join("")).join("\n");
}

describe("agent shell engine", () => {
  it("lists posts, projects, stamps, and labs via ls", async () => {
    const deps = createDeps();

    const postsResult = await executeShellCommand("ls posts", deps);
    expect(textOf(postsResult.lines)).toContain("agent-harness-not-model");
    expect(textOf(postsResult.lines)).toContain("2026-chiangmai-trip");

    const stampsResult = await executeShellCommand("ls stamps", deps);
    expect(textOf(stampsResult.lines)).toContain("初来乍到");
    expect(textOf(stampsResult.lines)).toContain("2026-04-01");

    const projectsResult = await executeShellCommand("ls projects", deps);
    expect(textOf(projectsResult.lines)).toContain("unquote");
  });

  it("greps posts using the search ranking engine", async () => {
    const result = await executeShellCommand("grep Harness", createDeps());
    const out = textOf(result.lines);

    expect(out).toContain("agent-harness-not-model");
    expect(out).not.toContain("2026-chiangmai-trip");
  });

  it("reads post Markdown with cat and collects the shell stamp", async () => {
    const deps = createDeps();
    const result = await executeShellCommand("cat agent-harness-not-model", deps);
    const out = textOf(result.lines);

    expect(out).toContain("Agent Harness，而不是模型本身\n# Harness");
    expect(out).toContain("≈ 9 tokens");
    expect(deps.collectShellStamp).toHaveBeenCalledTimes(1);
    expect(result.unlockedShellStamp).toBe(true);
  });

  it("invokes WebMCP tools with JSON or shorthand arguments", async () => {
    const deps = createDeps();

    const shorthand = await executeShellCommand("mcp call search_posts harness", deps);
    expect(deps.invokeTool).toHaveBeenCalledWith("search_posts", { query: "harness" });
    expect(textOf(shorthand.lines)).toContain('"total": 1');
    expect(deps.collectShellStamp).toHaveBeenCalled();

    await executeShellCommand('mcp call search_posts {"query":"Agent","limit":2}', deps);
    expect(deps.invokeTool).toHaveBeenCalledWith("search_posts", { query: "Agent", limit: 2 });
  });

  it("supports flip, fish, fortune, open, and clear commands", async () => {
    const deps = createDeps();

    expect((await executeShellCommand("clear", deps)).clear).toBe(true);
    expect((await executeShellCommand("flip", deps)).toggleFlip).toBe(true);
    expect((await executeShellCommand("open agent-harness-not-model", deps)).navigateTo).toBe(
      "/posts/agent-harness-not-model/",
    );
    expect((await executeShellCommand("open constructor", deps)).navigateTo).toBeUndefined();
    expect((await executeShellCommand("open photos", deps)).navigateTo).toBe("/photos/");
    expect(textOf((await executeShellCommand("fish", deps)).lines)).toContain("><(((°>");
    expect(textOf((await executeShellCommand("fortune", deps)).lines).length).toBeGreaterThan(5);
  });

  it("autocompletes commands and post slugs", () => {
    const slugs = samplePosts.map((post) => post.slug);

    expect(completeShellInput("mc", slugs)).toBe("mcp ");
    expect(completeShellInput("cat agent-", slugs)).toBe("cat agent-harness-not-model");
    expect(completeShellInput("ls pr", slugs)).toBe("ls projects");
  });
});
