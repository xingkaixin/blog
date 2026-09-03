type MediaRange = {
  order: number;
  quality: number;
  subtype: string;
  type: string;
};

function parseQuality(value: string | undefined) {
  if (!value) {
    return 1;
  }
  const normalized = value.trim().replace(/^"|"$/gu, "");
  if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/u.test(normalized)) {
    return 0;
  }
  return Number(normalized);
}

function parseAccept(value: string | null): MediaRange[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part, order) => {
      const [mediaRange, ...parameters] = part.split(";");
      const [type, subtype, ...rest] = (mediaRange ?? "").trim().toLowerCase().split("/");
      if (!type || !subtype || rest.length > 0) {
        return undefined;
      }

      const qualityParameters = parameters.filter((parameter) => /^\s*q\s*=/iu.test(parameter));
      const quality =
        qualityParameters.length > 1 ? 0 : parseQuality(qualityParameters[0]?.split("=", 2)[1]);
      return { order, quality, subtype, type };
    })
    .filter((range): range is MediaRange => range !== undefined);
}

function qualityFor(ranges: MediaRange[], type: string, subtype: string) {
  const candidates = ranges
    .map((range) => ({
      ...range,
      specificity:
        range.type === type && range.subtype === subtype
          ? 2
          : range.type === type && range.subtype === "*"
            ? 1
            : range.type === "*" && range.subtype === "*"
              ? 0
              : -1,
    }))
    .filter((range) => range.specificity >= 0)
    .toSorted(
      (left, right) =>
        right.specificity - left.specificity ||
        right.quality - left.quality ||
        left.order - right.order,
    );

  return candidates[0]?.quality ?? 0;
}

export function prefersMarkdown(value: string | null) {
  const ranges = parseAccept(value);
  const explicitlyAcceptsMarkdown = ranges.some(
    (range) => range.type === "text" && range.subtype === "markdown" && range.quality > 0,
  );

  return (
    explicitlyAcceptsMarkdown &&
    qualityFor(ranges, "text", "markdown") > qualityFor(ranges, "text", "html")
  );
}

export function markdownPathForPage(pathname: string) {
  if (pathname === "/") {
    return "/index.md";
  }
  return pathname.endsWith("/") ? `${pathname}index.md` : `${pathname}.md`;
}
