export const ARTICLE_FOOTER_REVEAL_THRESHOLD = 0.5;

export interface FooterRevealGeometry {
  top: number;
  bottom: number;
  height: number;
  viewportHeight: number;
  scrollY: number;
  scrollHeight: number;
}

/**
 * Determine whether the article footer has crossed the >50% visible height threshold
 * (or reached the page bottom on short landscape viewports where >50% cannot fit).
 */
export function shouldTriggerArticleFooterReveal(geo: FooterRevealGeometry): boolean {
  if (geo.height <= 0 || geo.viewportHeight <= 0) {
    return false;
  }
  const visibleTop = Math.max(0, geo.top);
  const visibleBottom = Math.min(geo.viewportHeight, geo.bottom);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  if (visibleHeight <= 0) {
    return false;
  }
  if (visibleHeight / geo.height >= ARTICLE_FOOTER_REVEAL_THRESHOLD) {
    return true;
  }
  return geo.scrollY + geo.viewportHeight >= geo.scrollHeight - 4;
}
