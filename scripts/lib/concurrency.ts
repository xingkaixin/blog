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
  const state: { failure: { reason: unknown } | null } = { failure: null };

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (state.failure === null) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) {
        return;
      }

      try {
        results[index] = await mapper(values[index], index);
      } catch (reason) {
        state.failure ??= { reason };
      }
    }
  });

  await Promise.all(workers);
  if (state.failure !== null) {
    throw state.failure.reason;
  }
  return results;
}
