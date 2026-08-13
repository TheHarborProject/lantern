/**
 * Settled outcome of a single job, tagged with the job's original index so
 * callers can re-associate results deterministically regardless of completion
 * order (RFC-014 §5/§19).
 */
export type JobOutcome<T> =
  | { readonly index: number; readonly status: "fulfilled"; readonly value: T }
  | { readonly index: number; readonly status: "rejected"; readonly reason: unknown };

/**
 * Run `jobs` with bounded concurrency (RFC-014 §5/§6/§12).
 *
 * At most `concurrency` jobs are active at any instant. A fixed pool of at
 * most `concurrency` workers pulls the next job from a shared cursor as it
 * becomes free, so this never launches every job at once the way
 * `Promise.all(jobs.map(...))` would. With `concurrency = 1` execution is
 * strictly sequential and follows the input order.
 *
 * The scheduler is intentionally generic: it understands only jobs, the
 * concurrency limit, job execution, and completion/failure. It knows nothing
 * about routes, authentication, output paths, or configuration.
 *
 * A rejecting job never corrupts the pool: its rejection is captured as a
 * `rejected` outcome, its worker slot is released, and remaining jobs keep
 * running. Every job that runs produces exactly one outcome; outcomes are
 * returned sorted by original index (completion order is not observable).
 *
 * @throws {RangeError} `concurrency` is not an integer `>= 1`.
 */
export async function runWithConcurrency<T>(
  jobs: readonly (() => Promise<T>)[],
  concurrency: number,
): Promise<readonly JobOutcome<T>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`concurrency must be an integer >= 1, received: ${String(concurrency)}`);
  }

  const outcomes: JobOutcome<T>[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    let index = nextIndex++;

    while (index < jobs.length) {
      const job = jobs[index];

      if (job !== undefined) {
        try {
          outcomes.push({ index, status: "fulfilled", value: await job() });
        } catch (reason) {
          outcomes.push({ index, status: "rejected", reason });
        }
      }

      index = nextIndex++;
    }
  }

  const workerCount = Math.min(concurrency, jobs.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  outcomes.sort((a, b) => a.index - b.index);
  return outcomes;
}
