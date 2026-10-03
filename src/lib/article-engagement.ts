const MIN_VISIBLE_MS = 30_000;

export function observeArticleEngagement(body: HTMLElement, onRead: () => void): () => void {
  let visibleMs = 0;
  let visibleSince = document.hidden ? null : performance.now();
  let deepest = 0;
  let timer = 0;

  function cleanup() {
    window.clearTimeout(timer);
    window.removeEventListener("scroll", check);
    window.removeEventListener("resize", check);
    document.removeEventListener("visibilitychange", visibilityChanged);
  }

  function check() {
    window.clearTimeout(timer);
    if (visibleSince === null) {
      return;
    }

    const rect = body.getBoundingClientRect();
    if (rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
      deepest = Math.max(deepest, (window.innerHeight - rect.top) / rect.height);
    }
    const remaining = MIN_VISIBLE_MS - visibleMs - (performance.now() - visibleSince);
    if (remaining <= 0 && deepest >= 0.5) {
      cleanup();
      onRead();
    } else if (remaining > 0) {
      timer = window.setTimeout(check, remaining);
    }
  }

  function visibilityChanged() {
    if (visibleSince !== null) {
      visibleMs += performance.now() - visibleSince;
    }
    visibleSince = document.hidden ? null : performance.now();
    check();
  }

  window.addEventListener("scroll", check, { passive: true });
  window.addEventListener("resize", check);
  document.addEventListener("visibilitychange", visibilityChanged);
  check();
  return cleanup;
}
