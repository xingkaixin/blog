const inactiveContainers = new WeakSet<HTMLElement>();

document.addEventListener("astro:before-swap", () => {
  const container = document.querySelector<HTMLElement>("[data-search-root]");
  if (container) {
    // 旧页面的退场动画期间，容器仍可能连接在文档上。
    inactiveContainers.add(container);
  }
});

export async function openSearch(): Promise<void> {
  const container = document.querySelector<HTMLElement>("[data-search-root]");
  if (!container || inactiveContainers.has(container)) {
    return;
  }
  const { openSearchDialog } = await import("@/components/search-dialog-entry");
  if (!inactiveContainers.has(container)) {
    openSearchDialog(container);
  }
}
