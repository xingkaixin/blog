import { describe, expect, it } from "vitest";
import { rehypeBlogContent } from "@/lib/rehype-blog-content";

describe("rehype blog content", () => {
  it("normalizes headings and external links", () => {
    const heading = {
      type: "element",
      tagName: "h1",
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

    expect(heading).toMatchObject({ tagName: "h2", properties: { id: "测试-heading" } });
    expect(externalLink.properties).toMatchObject({
      href: "https://example.com",
      target: "_blank",
      rel: "noreferrer",
    });
    expect(internalLink.properties).toEqual({ href: "/about/" });
  });

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
});
