import { observeArticleEngagement } from "./article-engagement";
import { siteConfig } from "./site";

export function installAnalytics() {
  const hostname = new URL(siteConfig.url).hostname;
  if (location.hostname !== hostname) {
    return;
  }

  let cleanup: (() => void) | undefined;
  function setupReading() {
    cleanup?.();
    cleanup = undefined;
    const body = document.querySelector<HTMLElement>(".article-prose");
    if (body && window.umami) {
      cleanup = observeArticleEngagement(body, () => {
        void window.umami?.track("article-read");
      });
    }
  }

  document.addEventListener("astro:page-load", setupReading);
  document.addEventListener("astro:before-swap", () => {
    cleanup?.();
    cleanup = undefined;
  });

  const load = () => {
    const script = document.createElement("script");
    script.src = "https://umami.xingkaixin.me/script.js";
    script.defer = true;
    script.dataset.websiteId = "da85e002-bf3e-4fcd-bbd9-9000cfb31fa4";
    script.dataset.domains = hostname;
    script.dataset.excludeHash = "true";
    script.dataset.performance = "true";
    script.addEventListener("load", setupReading, { once: true });
    document.head.append(script);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(load);
  } else {
    setTimeout(load, 0);
  }
}
