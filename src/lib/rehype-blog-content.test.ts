import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { describe, expect, it } from "vitest";
import { tocFromHeadings } from "@/lib/post-toc";
import { rehypeBlogContent } from "@/lib/rehype-blog-content";

describe("rehype blog content", () => {
  it("rejects first-level headings owned by frontmatter", () => {
    const heading = {
      type: "element",
      tagName: "h1",
      properties: {},
      children: [{ type: "text", value: "重复标题" }],
    };

    expect(() => rehypeBlogContent()({ type: "root", children: [heading] })).toThrow(
      "frontmatter title",
    );
  });

  it.each([{ markdown: "## 部署\n\n## 部署\n\n## 部署-2", ids: ["部署", "部署-2", "部署-2-2"] }])(
    "keeps rendered anchors unique and the TOC aligned for $markdown",
    async ({ markdown, ids }) => {
      const renderer = await createMarkdownProcessor({
        syntaxHighlight: false,
        rehypePlugins: [rehypeBlogContent],
      });
      const { code, metadata } = await renderer.render(markdown);
      const renderedIds = [...code.matchAll(/<h[2-6] id="([^"]+)"/g)].map((match) => match[1]);

      expect(renderedIds).toEqual(ids);
      expect(tocFromHeadings(metadata.headings)).toEqual(
        metadata.headings
          .filter(({ depth }) => depth === 2 || depth === 3)
          .map(({ depth, slug, text }) => ({ depth, id: slug, text })),
      );
    },
  );

  it("rejects managed post images that are missing from generated data", () => {
    const image = {
      type: "element",
      tagName: "img",
      properties: { src: "/posts/images/missing/source.jpg", alt: "缺失图片" },
      children: [],
    };

    expect(() => rehypeBlogContent()({ type: "root", children: [image] })).toThrow(
      "/posts/images/missing/source.jpg",
    );
  });
});
