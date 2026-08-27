import { createRoot, type Root } from "react-dom/client";
import { SearchDialog } from "@/components/search-dialog";
import { OPEN_SEARCH_EVENT } from "@/lib/site-events";

const roots = new WeakMap<HTMLElement, Root>();

export function openSearchDialog(container: HTMLElement): void {
  if (!container.isConnected) {
    return;
  }

  const existing = roots.get(container);
  if (existing) {
    window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
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
  root.render(<SearchDialog initialOpen />);
}
