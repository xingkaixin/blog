export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function searchTerms(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

export function matchesSearchQuery(value: string, query: string): boolean {
  const normalizedValue = normalizeSearchText(value);
  return searchTerms(query).every((term) => normalizedValue.includes(term));
}
