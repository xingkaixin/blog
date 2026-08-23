export type ReadingMetrics = {
  wordCount: number;
  readingMinutes: number;
};

export function estimateReadingMetrics(markdown: string): ReadingMetrics {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ");
  const hanCharacters = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latinWords = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0;
  const wordCount = hanCharacters + latinWords;
  const readingMinutes = Math.max(1, Math.ceil(hanCharacters / 400 + latinWords / 220));

  return { wordCount, readingMinutes };
}
