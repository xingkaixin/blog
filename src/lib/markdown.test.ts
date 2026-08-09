import { describe, expect, it } from "vitest";
import { estimateReadingMetrics, formatDisplayDate, tocFromHeadings } from "@/lib/markdown";

describe("tocFromHeadings", () => {
  it("uses the same rendered depths as the content plugin", () => {
    expect(
      tocFromHeadings([
        { depth: 1, text: "正文一级标题" },
        { depth: 2, text: "起点" },
        { depth: 3, text: "第二层" },
        { depth: 4, text: "细节" },
      ]),
    ).toEqual([
      { depth: 2, text: "正文一级标题", id: "正文一级标题" },
      { depth: 2, text: "起点", id: "起点" },
      { depth: 3, text: "第二层", id: "第二层" },
    ]);
  });

  it("shares duplicate ids with the content renderer after excluding a leading title", () => {
    expect(
      tocFromHeadings(
        [
          { depth: 1, text: "✨ 重复标题" },
          { depth: 2, text: "重复标题" },
          { depth: 3, text: "重复标题" },
        ],
        { excludeLeadingTitle: true },
      ),
    ).toEqual([
      { depth: 2, text: "重复标题", id: "重复标题-2" },
      { depth: 3, text: "重复标题", id: "重复标题-3" },
    ]);
  });

  it("allocates a fallback id for headings without letters or numbers", () => {
    expect(
      tocFromHeadings([
        { depth: 2, text: "✨" },
        { depth: 2, text: "✨" },
      ]),
    ).toEqual([
      { depth: 2, text: "✨", id: "section" },
      { depth: 2, text: "✨", id: "section-2" },
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
