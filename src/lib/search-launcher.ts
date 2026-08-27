const inactiveContainers = new WeakSet<HTMLElement>();
const pendingContainers = new WeakSet<HTMLElement>();

document.addEventListener("astro:before-swap", () => {
  const container = document.querySelector<HTMLElement>("[data-search-root]");
  if (container) {
    // 旧页面的退场动画期间，容器仍可能连接在文档上。
    inactiveContainers.add(container);
  }
});

export async function openSearch(): Promise<void> {
  const container = document.querySelector<HTMLElement>("[data-search-root]");
  if (!container || inactiveContainers.has(container) || pendingContainers.has(container)) {
    return;
  }
  pendingContainers.add(container);
  const errorMessage = container.querySelector<HTMLElement>("[data-search-error]");
  if (errorMessage) {
    errorMessage.hidden = true;
  }
  try {
    const { openSearchDialog } = await import("@/components/search-dialog-entry");
    if (container.isConnected && !inactiveContainers.has(container)) {
      openSearchDialog(container);
    }
  } catch (error) {
    console.error("加载搜索面板失败", error);
    if (errorMessage && container.isConnected && !inactiveContainers.has(container)) {
      errorMessage.hidden = false;
    }
  } finally {
    pendingContainers.delete(container);
  }
}
