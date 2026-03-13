import { describe, expect, it } from "vitest";
import { extractPlainText, extractToc, parseMarkdownPost } from "@/lib/content";

const source = `---
title: 文章标题
date: 2026-03-13
summary: 摘要
tags:
  - vite
  - react
cover: /posts/test/cover.svg
coverAlt: 测试封面
---

## 起点

这是一段正文，包含 [链接](https://example.com) 和 \`inline code\`。

### 第二层

\`\`\`ts
const name = "demo";
\`\`\`
`;

describe("content parsing", () => {
  it("parses frontmatter and reading data", () => {
    const post = parseMarkdownPost("test", source);

    expect(post).not.toBeNull();
    expect(post?.slug).toBe("test");
    expect(post?.tags).toEqual(["vite", "react"]);
    expect(post?.readingTime).toBeGreaterThan(0);
  });

  it("skips draft posts", () => {
    const draftSource = source.replace("coverAlt: 测试封面", "coverAlt: 测试封面\ndraft: true");
    expect(parseMarkdownPost("draft", draftSource)).toBeNull();
  });

  it("extracts toc entries", () => {
    expect(extractToc(source)).toEqual([
      { depth: 2, text: "起点", id: "起点" },
      { depth: 3, text: "第二层", id: "第二层" },
    ]);
  });

  it("keeps headings after thematic breaks in body", () => {
    const longSource = `---
title: 长文
date: 2026-03-13
summary: 摘要
tags:
  - review
cover: /posts/test/cover.svg
coverAlt: 测试封面
---

前言

---

## 🏢 工作回顾：从“交付任务”到“沉淀方法论”

### 🟢 上半年：数据基础设施与规范建设

正文
`;

    expect(extractToc(longSource)).toEqual([
      {
        depth: 2,
        text: "工作回顾：从“交付任务”到“沉淀方法论”",
        id: "工作回顾从交付任务到沉淀方法论",
      },
      {
        depth: 3,
        text: "上半年：数据基础设施与规范建设",
        id: "上半年数据基础设施与规范建设",
      },
    ]);
  });

  it("converts markdown into searchable plain text", () => {
    expect(extractPlainText(source)).toContain("这是一段正文，包含 链接 和 inline code");
  });
});
