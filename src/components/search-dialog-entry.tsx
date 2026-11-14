import { createRoot, type Root } from "react-dom/client";
import { SearchDialog, type OpenSearchOptions } from "@/components/search-dialog";
import { OPEN_SEARCH_EVENT } from "@/lib/site-events";

export type { OpenSearchOptions };

const roots = new WeakMap<HTMLElement, Root>();

export function openSearchDialog(container: HTMLElement, options?: OpenSearchOptions): void {
  if (!container.isConnected) {
    return;
  }

  const normalized: Required<OpenSearchOptions> = {
    source: options?.source === "pointer" ? "pointer" : "keyboard",
    triggerElement: options?.triggerElement ?? null,
  };

  const existing = roots.get(container);
  if (existing) {
    window.dispatchEvent(
      new CustomEvent<Required<OpenSearchOptions>>(OPEN_SEARCH_EVENT, { detail: normalized }),
    );
    return;
  }

  const root = createRoot(container);
  roots.set(container, root);
  document.addEventListener(
    "astro:before-swap",
    () => {
      root.unmount();
      roots.delete(container);
    },
    { once: true },
  );
  root.render(
    <SearchDialog
      initialSource={normalized.source}
      initialTriggerElement={normalized.triggerElement}
    />,
  );
}
