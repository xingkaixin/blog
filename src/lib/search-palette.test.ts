import { describe, expect, it } from "vitest";
import type { SearchIndexItem } from "./search-index";
import { buildSearchPalette } from "./search-palette";

const posts: SearchIndexItem[] = [
  {
    slug: "agent-testing",
    title: "Agent 测试",
    date: "2026-08-20",
    summary: "建立可靠的测试反馈",
    tags: ["AI编程"],
  },
  {
    slug: "agent-review",
    title: "Agent Review",
    date: "2026-08-19",
    summary: "审查自动生成的代码",
    tags: ["AI编程", "Code Review"],
  },
];

describe("search palette", () => {
  it("produces valid option IDs for tags containing spaces", () => {
    const items = buildSearchPalette(
      "Code Review",
      posts.map((post) => ({ ...post, tags: ["Code Review"] })),
    ).flatMap((group) => group.items);
    expect(items.some((item) => item.id.startsWith("tag-"))).toBe(true);
    expect(items.every((item) => !/\s/.test(item.id))).toBe(true);
  });
  it("builds recent posts and global commands before searching", () => {
    const groups = buildSearchPalette("", posts);

    expect(groups[0]).toMatchObject({
      label: "最近发布",
      items: [{ id: "post-agent-testing" }, { id: "post-agent-review" }],
    });
    expect(groups[1].items).toContainEqual(
      expect.objectContaining({ id: "action-theme", kind: "theme" }),
    );
  });

  it("combines matching posts and archived tags", () => {
    const groups = buildSearchPalette("AI编程", posts);

    expect(groups.find(({ label }) => label.startsWith("文章"))).toMatchObject({
      label: "文章 · 2",
      items: [{ id: "post-agent-testing" }, { id: "post-agent-review" }],
    });
    expect(groups.find(({ label }) => label === "标签")).toMatchObject({
      items: [
        {
          id: "tag-AI%E7%BC%96%E7%A8%8B",
          href: "/tags/AI%E7%BC%96%E7%A8%8B/",
        },
      ],
    });
  });

  it("keeps commands searchable while the post index is unavailable", () => {
    const groups = buildSearchPalette("主题", null);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("命令");
    expect(groups[0].items).toContainEqual(
      expect.objectContaining({ id: "action-theme", kind: "theme" }),
    );
  });
});
