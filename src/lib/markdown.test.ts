import { describe, expect, it } from "vitest";
import { estimateReadingMetrics, extractToc, formatDisplayDate } from "@/lib/markdown";

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

describe("extractToc", () => {
  it("extracts toc entries", () => {
    expect(extractToc(source)).toEqual([
      { depth: 2, text: "起点", id: "起点" },
      { depth: 3, text: "第二层", id: "第二层" },
    ]);
  });

  it("ignores headings inside fenced code", () => {
    const codeHeading = `${source}\n\`\`\`markdown\n## not-a-heading\n\`\`\``;

    expect(extractToc(codeHeading)).toEqual([
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
});

describe("formatDisplayDate", () => {
  it("formats a calendar date in Chinese", () => {
    expect(formatDisplayDate("2026-07-16")).toBe("2026年7月16日");
  });

  // 改写 process.env.TZ 会立即影响 Intl 的默认时区，因此该用例在任何宿主时区下
  // 都能挡住回归：去掉 formatDisplayDate 里的 timeZone 选项就会得到 3月12日。
  it("does not shift with the host timezone", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(formatDisplayDate("2026-03-13")).toBe("2026年3月13日");
    } finally {
      process.env.TZ = original;
    }
  });
});

describe("estimateReadingMetrics", () => {
  it("derives Chinese and Latin reading metrics from article text", () => {
    const metrics = estimateReadingMetrics(`---
title: 测试
---

这是正文，包含 four English words here。

[可见链接](https://example.com)

\`\`\`ts
const ignored = "code block";
\`\`\`
`);

    expect(metrics).toEqual({ wordCount: 14, readingMinutes: 1 });
  });

  it("always returns at least one minute", () => {
    expect(estimateReadingMetrics("")).toEqual({ wordCount: 0, readingMinutes: 1 });
  });
});
