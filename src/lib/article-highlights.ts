export type ArticleHighlight = {
  id: string;
  text: string;
  start?: number;
  prefix: string;
  suffix: string;
  createdAt: string;
};

export type ArticleHighlightDraft = Pick<ArticleHighlight, "text" | "prefix" | "suffix" | "start">;

export const HIGHLIGHT_ATTR = "data-article-highlight";
export const HIGHLIGHTS_CHANGED_EVENT = "site:highlights-changed";

const STORAGE_PREFIX = "article-highlights:";
const CONTEXT_CHARS = 24;

type TextSegment = {
  node: Text;
  start: number;
  end: number;
};

export function normalizeHighlightPath(path: string): string {
  const clean = path.split(/[?#]/, 1)[0] || "/";
  const withLeading = clean.startsWith("/") ? clean : `/${clean}`;
  return withLeading.replace(/\/+$/, "") || "/";
}

function storageKey(path: string): string {
  return `${STORAGE_PREFIX}${normalizeHighlightPath(path)}`;
}

function isValidHighlight(value: unknown): value is ArticleHighlight {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<ArticleHighlight>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.text === "string" &&
    item.text.trim().length > 0 &&
    (item.start === undefined ||
      (typeof item.start === "number" && Number.isSafeInteger(item.start) && item.start >= 0)) &&
    typeof item.prefix === "string" &&
    typeof item.suffix === "string" &&
    typeof item.createdAt === "string"
  );
}

export function readHighlights(path: string): ArticleHighlight[] {
  try {
    const raw = localStorage.getItem(storageKey(path));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidHighlight) : [];
  } catch {
    return [];
  }
}

export function writeHighlights(path: string, items: readonly ArticleHighlight[]): void {
  const normalizedPath = normalizeHighlightPath(path);
  try {
    if (items.length === 0) {
      localStorage.removeItem(`${STORAGE_PREFIX}${normalizedPath}`);
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}${normalizedPath}`, JSON.stringify(items));
    }
  } catch {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(HIGHLIGHTS_CHANGED_EVENT, { detail: { path: normalizedPath } }),
  );
}

export function addHighlight(path: string, draft: ArticleHighlightDraft): ArticleHighlight {
  const current = readHighlights(path);
  const existing = current.find(
    (item) =>
      item.start === draft.start &&
      item.text === draft.text &&
      item.prefix === draft.prefix &&
      item.suffix === draft.suffix,
  );
  if (existing) {
    return existing;
  }
  const created: ArticleHighlight = {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `hl-${crypto.randomUUID().slice(0, 8)}`
        : `hl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ...draft,
    createdAt: new Date().toISOString(),
  };
  writeHighlights(path, [...current, created]);
  return created;
}

export function removeHighlights(path: string, ids: readonly string[]): void {
  if (ids.length === 0) {
    return;
  }
  const dropSet = new Set(ids);
  const next = readHighlights(path).filter((item) => !dropSet.has(item.id));
  writeHighlights(path, next);
}

function collectTextSegments(scope: HTMLElement): { fullText: string; segments: TextSegment[] } {
  const segments: TextSegment[] = [];
  let offset = 0;
  const parts: string[] = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, quote-toolbar")) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) {
      const len = current.nodeValue?.length ?? 0;
      if (len > 0) {
        segments.push({ node: current, start: offset, end: offset + len });
        parts.push(current.nodeValue ?? "");
        offset += len;
      }
    }
    current = walker.nextNode();
  }
  return { fullText: parts.join(""), segments };
}

function boundaryOffset(
  segments: readonly TextSegment[],
  container: Node,
  offset: number,
  fullLength: number,
): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const seg = segments.find((candidate) => candidate.node === container);
    return seg ? Math.min(seg.end, seg.start + offset) : null;
  }
  const ref = container.childNodes[offset] ?? null;
  if (ref) {
    const match = segments.find(
      ({ node }) =>
        ref === node ||
        ref.contains(node) ||
        Boolean(ref.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    return match ? match.start : fullLength;
  }
  let lastInside: TextSegment | undefined;
  for (const seg of segments) {
    if (container.contains(seg.node)) {
      lastInside = seg;
    }
  }
  if (lastInside) {
    return lastInside.end;
  }
  const nextSeg = segments.find(({ node }) =>
    Boolean(container.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
  return nextSeg ? nextSeg.start : fullLength;
}

export function createHighlightDraftFromRange(
  scope: HTMLElement,
  range: Range,
): ArticleHighlightDraft | null {
  if (!scope.contains(range.commonAncestorContainer)) {
    return null;
  }
  const { fullText, segments } = collectTextSegments(scope);
  const rawStart = boundaryOffset(
    segments,
    range.startContainer,
    range.startOffset,
    fullText.length,
  );
  const rawEnd = boundaryOffset(segments, range.endContainer, range.endOffset, fullText.length);
  if (rawStart === null || rawEnd === null || rawEnd <= rawStart) {
    return null;
  }

  let start = rawStart;
  let end = rawEnd;
  while (start < end && /\s/.test(fullText[start] ?? "")) {
    start++;
  }
  while (end > start && /\s/.test(fullText[end - 1] ?? "")) {
    end--;
  }
  const text = fullText.slice(start, end);
  if (text.length < 2) {
    return null;
  }
  return {
    text,
    start,
    prefix: fullText.slice(Math.max(0, start - CONTEXT_CHARS), start),
    suffix: fullText.slice(end, end + CONTEXT_CHARS),
  };
}

export function findHighlightRange(
  fullText: string,
  entry: ArticleHighlightDraft,
): { start: number; end: number } | null {
  if (!entry.text) {
    return null;
  }
  const fullNeedle = `${entry.prefix}${entry.text}${entry.suffix}`;
  if (
    entry.start !== undefined &&
    entry.start >= entry.prefix.length &&
    fullText.startsWith(fullNeedle, entry.start - entry.prefix.length)
  ) {
    return { start: entry.start, end: entry.start + entry.text.length };
  }
  if (entry.prefix || entry.suffix) {
    const exact = fullText.indexOf(fullNeedle);
    if (exact !== -1) {
      const start = exact + entry.prefix.length;
      return { start, end: start + entry.text.length };
    }
  }
  if (entry.prefix) {
    const prefixNeedle = `${entry.prefix}${entry.text}`;
    const idx = fullText.indexOf(prefixNeedle);
    if (idx !== -1) {
      const start = idx + entry.prefix.length;
      return { start, end: start + entry.text.length };
    }
  }
  if (entry.suffix) {
    const suffixNeedle = `${entry.text}${entry.suffix}`;
    const idx = fullText.indexOf(suffixNeedle);
    if (idx !== -1) {
      return { start: idx, end: idx + entry.text.length };
    }
  }
  const bare = fullText.indexOf(entry.text);
  return bare !== -1 ? { start: bare, end: bare + entry.text.length } : null;
}

export function clearAllHighlightMarks(scope: HTMLElement): void {
  const marks = [...scope.querySelectorAll<HTMLElement>(`mark[${HIGHLIGHT_ATTR}]`)];
  const touchedParents = new Set<Node>();
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) {
      continue;
    }
    touchedParents.add(parent);
    mark.replaceWith(...mark.childNodes);
  }
  for (const parent of touchedParents) {
    parent.normalize();
  }
}

export function findHighlightIdsInRange(scope: HTMLElement, range: Range): string[] {
  const ids: string[] = [];
  const marks = scope.querySelectorAll<HTMLElement>(`mark[${HIGHLIGHT_ATTR}]`);
  for (const mark of marks) {
    const text = mark.firstChild;
    if (
      !(text instanceof Text) ||
      !range.intersectsNode(text) ||
      (range.startContainer === text && range.startOffset === text.length) ||
      (range.endContainer === text && range.endOffset === 0)
    ) {
      continue;
    }
    const id = mark.getAttribute(HIGHLIGHT_ATTR);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function wrapSegmentSlice(
  segment: TextSegment,
  sliceStart: number,
  sliceEnd: number,
  id: string,
): void {
  const localStart = sliceStart - segment.start;
  const localEnd = sliceEnd - segment.start;
  const target = segment.node;
  if (!target.parentNode || localStart >= localEnd) {
    return;
  }
  let middle = target;
  if (localStart > 0) {
    middle = middle.splitText(localStart);
  }
  if (localEnd - localStart < middle.length) {
    middle.splitText(localEnd - localStart);
  }
  const mark = document.createElement("mark");
  mark.setAttribute(HIGHLIGHT_ATTR, id);
  middle.parentNode?.insertBefore(mark, middle);
  mark.appendChild(middle);
}

export function syncHighlightsInScope(scope: HTMLElement, path: string): ArticleHighlight[] {
  clearAllHighlightMarks(scope);
  const stored = readHighlights(path);
  if (stored.length === 0) {
    return [];
  }

  const { fullText, segments } = collectTextSegments(scope);
  const matched = stored
    .map((entry) => {
      const span = findHighlightRange(fullText, entry);
      return span ? { entry, start: span.start, end: span.end } : null;
    })
    .filter(
      (item): item is { entry: ArticleHighlight; start: number; end: number } => item !== null,
    )
    .toSorted((a, b) => a.start - b.start);

  const nonOverlapping: { entry: ArticleHighlight; start: number; end: number }[] = [];
  for (const item of matched) {
    const prev = nonOverlapping.at(-1);
    if (!prev || item.start >= prev.end) {
      nonOverlapping.push(item);
    }
  }

  // 从文档尾部向前拆分文本节点，前面的偏移索引始终有效
  for (const { entry, start, end } of nonOverlapping.toReversed()) {
    const overlapping = segments.filter((seg) => seg.end > start && seg.start < end);
    for (const seg of overlapping.toReversed()) {
      wrapSegmentSlice(seg, Math.max(seg.start, start), Math.min(seg.end, end), entry.id);
    }
  }

  return nonOverlapping.map((item) => item.entry);
}
