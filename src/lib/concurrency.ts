import "server-only";

/**
 * Run `task` over `items` with at most `limit` in flight at once.
 *
 * The crons used to process users strictly one-at-a-time, so total runtime grew
 * linearly with the user base and would blow past the function timeout at scale.
 * This bounds a fan-out: enough overlap to stay well under the limit, without
 * unleashing unbounded concurrency on the database or upstream providers.
 *
 * Each task is isolated — one rejection never aborts the others. Results come
 * back as a settled array in input order so callers can tally success/failure.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;

  const runWorker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: "fulfilled", value: await task(items[i], i) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}
