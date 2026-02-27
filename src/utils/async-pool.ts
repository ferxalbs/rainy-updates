export async function asyncPool<T>(
  concurrency: number,
  tasks: Array<() => Promise<T>>,
): Promise<Array<T | Error>> {
  const limit = Math.max(1, concurrency);
  const results: Array<T | Error> = new Array(tasks.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= tasks.length) return;

      try {
        results[current] = await tasks[current]();
      } catch (error) {
        results[current] = error instanceof Error ? error : new Error(String(error));
      }
    }
  });

  await Promise.all(workers);
  return results;
}
