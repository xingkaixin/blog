import { describe, expect, it } from "vitest";
import { estimateReadingMetrics } from "@/lib/reading-metrics";

describe("estimateReadingMetrics", () => {
  it("derives Chinese and Latin reading metrics from article text", () => {
    const metrics = estimateReadingMetrics(`这是正文，包含 four English words here。

[可见链接](https://example.com)

\`\`\`ts
const ignored = "code block";
\`\`\`
`);

    expect(metrics).toEqual({ wordCount: 14, readingMinutes: 1 });
  });

  it("always returns at least one minute", () => {
    expect(estimateReadingMetrics("")).toEqual({
      wordCount: 0,
      readingMinutes: 1,
    });
  });
});
