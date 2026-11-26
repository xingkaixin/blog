import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computePostSourceHash, validateSingleTranslation } from "./validate-post-translations";

const sampleChinesePost = `---
title: "测试文章"
date: "2026-07-11"
summary: 测试摘要
tags:
  - AI编程
cover: agent-friendly-tool.png
coverAlt: 测试封面
---

第一段内容。

![示例图](/posts/images/demo/a.png)

## 小节标题

\`\`\`ts
const x = 1;
\`\`\`
`;

describe("post translation validator", () => {
  it("accepts a matching English translation and rejects structural drift", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "post-translation-test-"));
    const postsDir = path.join(root, "posts");
    const enDir = path.join(root, "posts-en");
    fs.mkdirSync(postsDir, { recursive: true });
    fs.mkdirSync(enDir, { recursive: true });

    fs.writeFileSync(path.join(postsDir, "demo.md"), sampleChinesePost);
    const hash = computePostSourceHash(sampleChinesePost);

    try {
      const validEnglish = `---
title: "Sample Post"
summary: "Sample summary."
coverAlt: "Sample cover"
sourceHash: "${hash}"
---

First paragraph.

![Sample diagram](/posts/images/demo/a.png)

## Section Heading

\`\`\`ts
const x = 1;
\`\`\`
`;
      fs.writeFileSync(path.join(enDir, "demo.md"), validEnglish);
      expect(validateSingleTranslation("demo", postsDir, enDir)).toEqual([]);

      fs.writeFileSync(
        path.join(enDir, "demo.md"),
        validEnglish.replace("/posts/images/demo/a.png", "/posts/images/demo/wrong.png"),
      );
      expect(validateSingleTranslation("demo", postsDir, enDir)).toEqual([
        expect.objectContaining({ slug: "demo", message: expect.stringContaining("image URLs") }),
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
