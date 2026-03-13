export const TOC_ACTIVE_OFFSET = 112;

export function resolveActiveTocId(
  tocIds: string[],
  visibleIds: Iterable<string>,
  previousActiveId: string | null = null,
) {
  if (!tocIds.length) {
    return null;
  }

  const visibleIdSet = visibleIds instanceof Set ? visibleIds : new Set(visibleIds);

  for (let index = tocIds.length - 1; index >= 0; index -= 1) {
    const tocId = tocIds[index];
    if (visibleIdSet.has(tocId)) {
      return tocId;
    }
  }

  if (previousActiveId && tocIds.includes(previousActiveId)) {
    return previousActiveId;
  }

  return tocIds[0];
}
