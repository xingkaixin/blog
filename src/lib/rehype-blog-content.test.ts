import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { describe, expect, it } from "vitest";
import { tocFromHeadings } from "@/lib/post-toc";
import { rehypeBlogContent } from "@/lib/rehype-blog-content";

describe("rehype blog content", () => {
  it("normalizes headings and external links", () => {
    const heading = {
      type: "element",
      tagName: "h2",
      properties: {},
      children: [{ type: "text", value: "✨ 测试 Heading" }],
    };
    const externalLink = {
      type: "element",
      tagName: "a",
      properties: { href: "https://example.com" },
      children: [{ type: "text", value: "外链" }],
    };
    const internalLink = {
      type: "element",
      tagName: "a",
      properties: { href: "/about/" },
      children: [{ type: "text", value: "内链" }],
    };
    const tree = { type: "root", children: [heading, externalLink, internalLink] };

    rehypeBlogContent()(tree);

    expect(heading).toMatchObject({ properties: { id: "测试-heading" } });
    expect(externalLink.properties).toMatchObject({
      href: "https://example.com",
      target: "_blank",
      rel: "noreferrer",
    });
    expect(internalLink.properties).toEqual({ href: "/about/" });
  });

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

  it("assigns stable unique ids to repeated headings", () => {
    const first = {
      type: "element",
      tagName: "h2",
      properties: {},
      children: [{ type: "text", value: "重复标题" }],
    };
    const second = structuredClone(first);
    const linked = {
      type: "element",
      tagName: "h2",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "a",
          properties: { href: "https://example.com" },
          children: [{ type: "text", value: "Docs" }],
        },
      ],
    };

    rehypeBlogContent()({ type: "root", children: [first, second, linked] });

    expect(first.properties).toMatchObject({ id: "重复标题" });
    expect(second.properties).toMatchObject({ id: "重复标题-2" });
    expect(linked.properties).toMatchObject({ id: "docs" });
  });

  it.each([
    { markdown: "## 部署\n\n## 部署\n\n## 部署-2", ids: ["部署", "部署-2", "部署-2-2"] },
    { markdown: "## 部署-2\n\n## 部署\n\n## 部署", ids: ["部署-2", "部署", "部署-3"] },
    { markdown: "## ✨\n\n## section-2\n\n## ✨", ids: ["section", "section-2", "section-3"] },
    {
      markdown: "## [Docs](https://example.com)\n\n#### Docs\n\n### **Docs**",
      ids: ["docs", "docs-2", "docs-3"],
    },
  ])(
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

  it("adds lazy responsive markup to known post images", () => {
    const image = {
      type: "element",
      tagName: "img",
      properties: {
        src: "/posts/images/agent-friendly-tool/agent-friendly-tool-01.png",
        alt: "Agent 工具示意图",
      },
      children: [],
    };
    const tree = { type: "root", children: [image] };

    rehypeBlogContent()(tree);

    expect(image.tagName).toBe("picture");
    expect(image.children).toHaveLength(3);
    expect(image.children[0]).toMatchObject({
      tagName: "source",
      properties: { media: "(max-width: 767px)", type: "image/webp" },
    });
    expect(image.children[2]).toMatchObject({
      tagName: "img",
      properties: {
        alt: "Agent 工具示意图",
        loading: "lazy",
        src: "/posts/images/agent-friendly-tool/agent-friendly-tool-01.webp",
      },
    });
  });

  it("keeps unknown images and adds presentation defaults", () => {
    const image = {
      type: "element",
      tagName: "img",
      properties: { src: "/images/external.png", alt: "外部图片" },
      children: [],
    };
    const tree = { type: "root", children: [image] };

    rehypeBlogContent()(tree);

    expect(image).toMatchObject({
      tagName: "img",
      properties: {
        src: "/images/external.png",
        loading: "lazy",
        className: ["block", "w-full", "rounded-2xl"],
      },
    });
  });

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
