// Time-sliced work (code review fix round 1, perf). The scan is written as generators that `yield`
// between small units of work. `drain` runs one to the end at once (tests, the welcome page, the
// web app); `runSliced` runs it in slices of a few milliseconds and hands the thread back between
// slices, so a content script never holds the main thread of a page for a long task. Pure: the
// clock and the yield are passed in.

export type Steps<T> = Generator<void, T>;

/** Runs a step generator to completion in one go. */
export function drain<T>(steps: Steps<T>): T {
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

export interface SliceOptions {
  /** Milliseconds of work before handing the thread back. ADR: 8. */
  sliceMs?: number;
  now: () => number;
  /** Resolves on a later task (scheduler.yield, or setTimeout 0). */
  yieldToMain: () => Promise<void>;
}

/** Runs a step generator in time slices. */
export async function runSliced<T>(steps: Steps<T>, options: SliceOptions): Promise<T> {
  const budget = options.sliceMs ?? 8;
  let start = options.now();
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
    if (options.now() - start >= budget) {
      await options.yieldToMain();
      start = options.now();
    }
  }
}
