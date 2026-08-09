export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new Error("concurrency must be a positive safe integer");
  }

  const results: R[] = [];
  results.length = values.length;
  let nextIndex = 0;
  let firstError: unknown;

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (firstError === undefined) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) {
        return;
      }

      try {
        results[index] = await mapper(values[index], index);
      } catch (error) {
        firstError ??= error;
      }
    }
  });

  await Promise.all(workers);
  if (firstError !== undefined) {
    throw firstError;
  }
  return results;
}
