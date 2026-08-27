export function skipToContent(event: MouseEvent): void {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element) ||
    !event.target.closest('a[href="#main-content"]')
  ) {
    return;
  }
  const main = document.getElementById("main-content");
  if (!main) {
    return;
  }
  event.preventDefault();
  main.focus({ preventScroll: true });
  main.scrollIntoView({ behavior: "instant", block: "start" });
}
