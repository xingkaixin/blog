import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildHeadingId, normalizeHeadingText } from "@/lib/content";
import { postImages } from "@/lib/post-images";

function flattenNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenNodeText).join("");
  }

  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return flattenNodeText(props?.children ?? "");
  }

  return "";
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="article-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a
              {...props}
              className="font-medium underline decoration-accent/40 underline-offset-4 hover:decoration-ink-800"
              target={props.href?.startsWith("http") ? "_blank" : undefined}
              rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
            />
          ),
          img: ({ src, alt, title }) => {
            const responsive = src ? postImages[src] : undefined;
            if (responsive) {
              return (
                <picture>
                  <source srcSet={responsive.mobile} media="(max-width: 767px)" type="image/webp" />
                  <source srcSet={responsive.desktop} media="(min-width: 768px)" type="image/webp" />
                  <img
                    src={responsive.webp}
                    alt={alt}
                    title={title}
                    loading="lazy"
                    className="block w-full rounded-2xl"
                  />
                </picture>
              );
            }
            return <img src={src} alt={alt} title={title} loading="lazy" className="block w-full rounded-2xl" />;
          },
          h2: ({ children, ...props }) => {
            const text = normalizeHeadingText(flattenNodeText(children));
            return (
              <h2 id={buildHeadingId(text)} {...props}>
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const text = normalizeHeadingText(flattenNodeText(children));
            return (
              <h3 id={buildHeadingId(text)} {...props}>
                {children}
              </h3>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
