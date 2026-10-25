import { resolvePostImage } from "./post-images";
import { createHeadingIdAllocator } from "./post-toc";
import { siteConfig } from "./site";

const siteOrigin = new URL(siteConfig.url).origin;

function isExternalWebLink(href: string): boolean {
  try {
    const url = new URL(href, siteConfig.url);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin !== siteOrigin;
  } catch {
    return false;
  }
}

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

function element(tagName: string, className: string, children: HastNode[]): HastNode {
  return { type: "element", tagName, properties: { className: [className] }, children };
}

// 纸面上点不了链接，外链在正文里编号，完整地址列在文末
function printReferences(references: Map<string, { index: number; text: string }>): HastNode {
  return element("section", "print-references", [
    element("p", "print-references-title", [{ type: "text", value: "文中链接" }]),
    element(
      "ol",
      "print-references-list",
      [...references].map(([href, { text }]) =>
        element("li", "print-reference", [
          ...(text === href
            ? []
            : [element("span", "print-reference-text", [{ type: "text", value: text }])]),
          element("span", "print-reference-url", [{ type: "text", value: href }]),
        ]),
      ),
    ),
  ]);
}

export function rehypeBlogContent() {
  return (tree: HastNode) => {
    const allocateHeadingId = createHeadingIdAllocator();
    const references = new Map<string, { index: number; text: string }>();

    walk(tree, (node) => {
      if (node.type !== "element") {
        return;
      }

      if (isHeading(node.tagName)) {
        if (node.tagName === "h1") {
          throw new Error("文章正文不能包含一级标题，请使用 frontmatter title");
        }
        if (typeof node.properties?.id === "string") {
          return;
        }
        node.properties = {
          ...node.properties,
          id: allocateHeadingId(textContent(node)),
        };
        return;
      }

      if (node.tagName === "a" && typeof node.properties?.href === "string") {
        const href = node.properties.href;
        if (isExternalWebLink(href)) {
          const reference = references.get(href) ?? {
            index: references.size + 1,
            text: textContent(node),
          };
          references.set(href, reference);
          node.properties = {
            ...node.properties,
            target: "_blank",
            rel: "noreferrer",
            dataPrintRef: reference.index,
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
            width: responsive.width,
            height: responsive.height,
            loading: "lazy",
            className: ["block", "w-full", "rounded-2xl"],
          },
          children: [],
        },
      ];
    });

    if (references.size > 0) {
      tree.children = [...(tree.children ?? []), printReferences(references)];
    }
  };
}
