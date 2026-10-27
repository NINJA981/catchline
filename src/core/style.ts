// StyleOracle implementations that need no layout engine.

import type { StyleOracle } from './types';

const FONT_SIZE_RE = /font-size\s*:\s*([\d.]+)(px|pt|em|rem|%)/i;

/**
 * Reads inline `font-size` declarations up the ancestor chain. Reduced corpus snapshots keep the
 * computed font size inline (ADR §8), so this oracle works for unit tests and the corpus scorer.
 * em and % resolve against the parent; rem against `rootPx`.
 */
export function createInlineStyleOracle(rootPx = 16): StyleOracle {
  const cache = new WeakMap<Element, number>();
  const resolve = (el: Element | null): number => {
    if (!el) return rootPx;
    const cached = cache.get(el);
    if (cached !== undefined) return cached;
    const m = FONT_SIZE_RE.exec(el.getAttribute('style') ?? '');
    let px: number;
    if (m?.[1] && m[2]) {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      const parentPx = resolve(el.parentElement);
      px =
        unit === 'px'
          ? n
          : unit === 'pt'
            ? (n * 4) / 3
            : unit === 'em'
              ? n * parentPx
              : unit === 'rem'
                ? n * rootPx
                : (n / 100) * parentPx;
    } else if (el.tagName === 'SMALL') {
      px = resolve(el.parentElement) * (13 / 16);
    } else {
      px = resolve(el.parentElement);
    }
    cache.set(el, px);
    return px;
  };
  return { fontSizePx: (el) => resolve(el) };
}

/** The slice of `Window` the computed-style oracle needs; injectable for tests. */
export interface ComputedStyleSource {
  getComputedStyle(el: Element): { fontSize: string };
}

/**
 * getComputedStyle-backed oracle for a live page (content script, web app, corpus scorer).
 * The window is passed in, so this module touches no globals.
 */
export function createComputedStyleOracle(win: ComputedStyleSource): StyleOracle {
  const cache = new WeakMap<Element, number | null>();
  return {
    fontSizePx(el) {
      const cached = cache.get(el);
      if (cached !== undefined) return cached;
      let px: number | null;
      try {
        const v = parseFloat(win.getComputedStyle(el).fontSize);
        px = Number.isFinite(v) && v > 0 ? v : null;
      } catch {
        px = null;
      }
      cache.set(el, px);
      return px;
    },
  };
}
