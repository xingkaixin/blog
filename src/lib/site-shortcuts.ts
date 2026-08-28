import { THEME_TOGGLE_EVENT } from "./site-events";

export const siteShortcuts = {
  search: { key: "k", hint: "⌘K" },
  theme: { key: "j", hint: "⌘J" },
} as const;

export function installSiteShortcuts(target: Window): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    const typing =
      event.target instanceof HTMLElement &&
      (event.target.matches("input, textarea, select") || event.target.isContentEditable);
    if (typing || event.defaultPrevented || event.isComposing || event.repeat || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    const command = event.metaKey || event.ctrlKey;
    if ((command && key === siteShortcuts.search.key) || (!command && key === "/")) {
      event.preventDefault();
      void import("./search-launcher")
        .then(({ openSearch }) => openSearch())
        .catch((error) => {
          console.error("加载搜索快捷键失败", error);
        });
    } else if (command && key === siteShortcuts.theme.key) {
      event.preventDefault();
      target.dispatchEvent(new Event(THEME_TOGGLE_EVENT));
    }
  };

  target.addEventListener("keydown", handleKeyDown);
  return () => target.removeEventListener("keydown", handleKeyDown);
}
