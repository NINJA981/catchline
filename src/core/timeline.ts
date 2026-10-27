// The signature moment's timings (DESIGN.md "Signature Moment: the footnote flight"). Pure.

export const SIGNATURE = {
  total: 960,
  lift: 120,
  flightStart: 80,
  flightEnd: 560,
  dockEnd: 680,
  chipStart: 680,
  chipStep: 80,
  finePrintStart: 840,
  finePrintDuration: 120,
  /** Only this many chips animate individually; the rest appear with the last. */
  maxAnimatedChips: 4,
} as const;

/** Short version, later opens on the same page (DESIGN.md). */
export const SHORT = { card: 150, tether: 120 } as const;

/** Reduced motion: card and tether fade together (DESIGN.md). */
export const REDUCED = { fade: 150 } as const;

export type MotionVariant = 'flight' | 'short' | 'reduced';

export function chooseVariant(opts: { reducedMotion: boolean; firstOpen: boolean }): MotionVariant {
  if (opts.reducedMotion) return 'reduced';
  return opts.firstOpen ? 'flight' : 'short';
}

/** Start time (ms into the moment) of the nth chip. */
export function chipStartMs(index: number): number {
  const i = Math.min(index, SIGNATURE.maxAnimatedChips - 1);
  return SIGNATURE.chipStart + i * SIGNATURE.chipStep;
}

/** Cubic-bezier easing as a function of progress (the flight uses cubic-bezier(0.77, 0, 0.175, 1)). */
export function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}
