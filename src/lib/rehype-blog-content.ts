import { buildHeadingId, normalizeHeadingText } from "./markdown";
import { postImages } from "./post-images";

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function walk(node: HastNode, visitor: (node: HastNode) => void) {
  visitor(node);
  for (const child of node.children ?? []) {
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
    walk(tree, (node) => {
      if (node.type !== "element") {
        return;
      }

      if (isHeading(node.tagName)) {
        const text = normalizeHeadingText(textContent(node));
        node.properties = {
          ...node.properties,
          id: buildHeadingId(text),
        };

        if (node.tagName === "h1") {
          node.tagName = "h2";
        }
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

      const responsive = postImages[node.properties.src];
      if (!responsive) {
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
