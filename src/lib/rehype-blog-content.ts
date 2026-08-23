import { resolvePostImage } from "./post-images";
import { createHeadingIdAllocator } from "./post-toc";

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function walk(node: HastNode, visitor: (node: HastNode) => void) {
  const children = node.children ?? [];
  visitor(node);
  for (const child of children) {
    walk(child, visitor);
  }
}

function textContent(node: HastNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }

  return (node.children ?? []).map(textContent).join("");
}

function isHeading(tagName: string | undefined) {
  return /^h[1-6]$/.test(tagName ?? "");
}

export function rehypeBlogContent() {
  return (tree: HastNode) => {
    const allocateHeadingId = createHeadingIdAllocator();

    walk(tree, (node) => {
      if (node.type !== "element") {
        return;
      }

      if (isHeading(node.tagName)) {
        if (node.tagName === "h1") {
          throw new Error("文章正文不能包含一级标题，请使用 frontmatter title");
        }
        node.properties = {
          ...node.properties,
          id: allocateHeadingId(textContent(node)),
        };
        return;
      }

      if (node.tagName === "a" && typeof node.properties?.href === "string") {
        const href = node.properties.href;
        if (href.startsWith("http")) {
          node.properties = {
            ...node.properties,
            target: "_blank",
            rel: "noreferrer",
          };
        }
        return;
      }

      if (node.tagName !== "img" || typeof node.properties?.src !== "string") {
        return;
      }

      const responsive = resolvePostImage(node.properties.src);
      if (!responsive) {
        if (node.properties.src.startsWith("/posts/images/")) {
          throw new Error(`文章插图没有对应的生成数据: ${node.properties.src}`);
        }
        node.properties = {
          ...node.properties,
          loading: "lazy",
          className: ["block", "w-full", "rounded-2xl"],
        };
        return;
      }

      const { alt, title } = node.properties;
      node.tagName = "picture";
      node.properties = {};
      node.children = [
        {
          type: "element",
          tagName: "source",
          properties: {
            srcSet: responsive.mobile,
            media: "(max-width: 767px)",
            type: "image/webp",
          },
          children: [],
        },
        {
          type: "element",
          tagName: "source",
          properties: {
            srcSet: responsive.desktop,
            media: "(min-width: 768px)",
            type: "image/webp",
          },
          children: [],
        },
        {
          type: "element",
          tagName: "img",
          properties: {
            src: responsive.webp,
            alt,
            title,
            loading: "lazy",
            className: ["block", "w-full", "rounded-2xl"],
          },
          children: [],
        },
      ];
    });
  };
}
