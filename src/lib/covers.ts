import coverData from "./generated/covers.json";

export type ResponsiveCover = {
  full: string;
  desktop: string;
  mobile: string;
  fullAvif: string;
  desktopAvif: string;
  mobileAvif: string;
  width: number;
  height: number;
};

export const POST_COVER_SIZES =
  "(max-width: 639px) calc(100vw - 24px), (max-width: 1023px) calc(100vw - 40px), 860px";

const covers: Record<string, ResponsiveCover> = coverData;

export function resolveCover(filename: string): ResponsiveCover {
  const cover = covers[filename];
  if (!cover) {
    throw new Error(`Cover image has no generated variants: ${filename}`);
  }
  return cover;
}

export function buildCoverSrcSet(
  cover: Pick<ResponsiveCover, "width">,
  variants: { mobile: string; desktop: string; full: string },
): string {
  if (cover.width > 800) {
    return `${variants.mobile} 400w, ${variants.desktop} 800w, ${variants.full} ${cover.width}w`;
  }
  if (cover.width > 400) {
    return `${variants.mobile} 400w, ${variants.full} ${cover.width}w`;
  }
  return `${variants.full} ${cover.width}w`;
}
