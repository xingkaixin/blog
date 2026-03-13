export const TOC_ACTIVE_OFFSET = 112;

type HeadingLike = {
  id: string;
  getBoundingClientRect: () => Pick<DOMRect, "top">;
};

export function resolveActiveTocId(headings: HeadingLike[], topOffset = TOC_ACTIVE_OFFSET) {
  if (!headings.length) {
    return null;
  }

  const currentHeading = headings.findLast((heading) => heading.getBoundingClientRect().top <= topOffset);
  return currentHeading?.id ?? headings[0].id;
}
