// Rescan on DOM changes (ADR §3): MutationObserver, debounced, with a budget so pages that churn
// forever (tickers, carousels) stop costing anything once they stop yielding new markers.

export interface RescanObserverOptions {
  /** Debounce between the last mutation and the rescan. ADR: 300 ms. */
  debounceMs?: number;
  /** Stop observing after this many rescans in a row that found nothing new. ADR: 200. */
  maxIdleBatches?: number;
  /**
   * Longest a rescan may be postponed by a page that keeps mutating (a ticker, a carousel). Without
   * it the debounce is reset by every batch and such a page is never rescanned. Default 2000 ms.
   */
  maxWaitMs?: number;
  /** Mutations inside nodes this returns true for are ignored (Catchline's own UI). */
  ignore?: (node: Node) => boolean;
}

export interface RescanObserver {
  disconnect(): void;
  /** Reconnect and reset the idle budget (SPA navigation). */
  rearm(): void;
  readonly active: boolean;
}

/**
 * `onRescan` runs after mutations settle and returns how many new markers it found; a run that
 * finds none counts toward the idle budget.
 */
export function createRescanObserver(
  root: Node,
  onRescan: () => number | Promise<number>,
  options: RescanObserverOptions = {},
): RescanObserver {
  const debounceMs = options.debounceMs ?? 300;
  const maxIdle = options.maxIdleBatches ?? 200;
  const maxWait = options.maxWaitMs ?? 2000;
  const ignore = options.ignore ?? defaultIgnore;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstAt = 0;
  let idle = 0;
  let active = false;

  const settle = (found: number) => {
    idle = found > 0 ? 0 : idle + 1;
    if (idle >= maxIdle) stop();
  };
  const run = () => {
    timer = null;
    const found = onRescan();
    if (typeof found === 'number') settle(found);
    else void found.then(settle, () => undefined);
  };

  const observer = new MutationObserver((records) => {
    // A record is our own when it happens inside Catchline's UI, or only adds or removes Catchline's
    // hosts (they are children of <html>, which is observed so a swapped <body> is still watched).
    const own = (r: MutationRecord) => {
      if (ignore(r.target)) return true;
      if (r.type !== 'childList') return false;
      const nodes = [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)];
      return nodes.length > 0 && nodes.every(ignore);
    };
    if (records.every(own)) return;
    const now = Date.now();
    if (timer !== null) clearTimeout(timer);
    else firstAt = now;
    timer = setTimeout(run, Math.max(0, Math.min(debounceMs, firstAt + maxWait - now)));
  });

  const start = () => {
    if (active) return;
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    active = true;
  };
  const stop = () => {
    observer.disconnect();
    if (timer !== null) clearTimeout(timer);
    timer = null;
    active = false;
  };

  start();
  return {
    disconnect: stop,
    rearm() {
      idle = 0;
      start();
    },
    get active() {
      return active;
    },
  };
}

function defaultIgnore(node: Node): boolean {
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
  return el?.closest('[data-catchline]') != null;
}
