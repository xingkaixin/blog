const TOC_ANCHOR_OFFSET = 112;
export const TOC_ACTIVE_OFFSET = TOC_ANCHOR_OFFSET + 1;

export function resolveActiveTocId(
  tocIds: string[],
  visibleIds: Iterable<string>,
  isAtPageEnd = false,
) {
  if (!tocIds.length) {
    return null;
  }

  if (isAtPageEnd) {
    return tocIds[tocIds.length - 1];
  }

  const visibleIdSet = visibleIds instanceof Set ? visibleIds : new Set(visibleIds);

  for (let index = tocIds.length - 1; index >= 0; index -= 1) {
    const tocId = tocIds[index];
    if (visibleIdSet.has(tocId)) {
      return tocId;
    }
  }

  return tocIds[0];
}
