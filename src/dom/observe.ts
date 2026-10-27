// Rescan on DOM changes (ADR §3): MutationObserver, debounced, with a budget so pages that churn
// forever (tickers, carousels) stop costing anything once they stop yielding new markers.

export interface RescanObserverOptions {
  /** Debounce between the last mutation and the rescan. ADR: 300 ms. */
  debounceMs?: number;
  /** Stop observing after this many rescans in a row that found nothing new. ADR: 200. */
  maxIdleBatches?: number;
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
  onRescan: () => number,
  options: RescanObserverOptions = {},
): RescanObserver {
  const debounceMs = options.debounceMs ?? 300;
  const maxIdle = options.maxIdleBatches ?? 200;
  const ignore = options.ignore ?? defaultIgnore;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let idle = 0;
  let active = false;

  const run = () => {
    timer = null;
    const found = onRescan();
    idle = found > 0 ? 0 : idle + 1;
    if (idle >= maxIdle) stop();
  };

  const observer = new MutationObserver((records) => {
    if (!records.some((r) => !ignore(r.target))) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, debounceMs);
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
