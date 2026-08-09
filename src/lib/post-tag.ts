const TAG_WHITESPACE_PATTERN = /\s+/gu;

const TAG_ALIASES = new Map<string, string>([["AI 编程", "AI编程"]]);

export function canonicalTag(value: string): string {
  const normalized = value.normalize("NFKC").trim().replace(TAG_WHITESPACE_PATTERN, " ");
  return TAG_ALIASES.get(normalized) ?? normalized;
}

export function canonicalTags(values: string[]): string[] {
  return values.map(canonicalTag);
}
