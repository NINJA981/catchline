// The signature moment and its short and reduced-motion variants (DESIGN.md "Signature Moment: the
// footnote flight"). Every step is WAAPI (native element.animate, plus Motion's mini animate for the
// springs), so each piece is interruptible: finish() jumps to the end state, cancel() restores.

import { animate } from 'motion/mini';
import {
  chipStartMs,
  cubicBezierEase,
  REDUCED,
  SHORT,
  SIGNATURE,
  type MotionVariant,
} from '../core';

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

export const flightEase = cubicBezierEase(0.77, 0, 0.175, 1);

export interface FlightParts {
  card: HTMLElement;
  chips: HTMLElement[];
  fine: HTMLElement | null;
  /** Short tether (marker to card). */
  tetherGroup: SVGGElement | null;
  tetherLine: SVGPathElement | null;
  tetherGlow: SVGPathElement | null;
  /** The long footnote-to-card tether drawn only during the flight. */
  flightPath: SVGPathElement | null;
  flightGlow: SVGPathElement | null;
  clone: HTMLElement | null;
  tag: HTMLElement | null;
  /** SVG path data for the clone: footnote start to card landing point. */
  flightD: string | null;
  /** Reading-size scale the clone grows to (13px over the footnote's own size). */
  scaleEnd: number;
  /** Where the card scales from, as a transform-origin string. */
  cardOrigin: string;
}

export interface Playback {
  /** Jump to the end state, then clean up. */
  finish(): void;
  /** Stop and restore everything (used on unmount). */
  cancel(): void;
  done: Promise<void>;
}

type Stop = { finish: () => void; cancel: () => void };

export function play(variant: MotionVariant, p: FlightParts, onEnd: () => void): Playback {
  const stops: Stop[] = [];
  const waits: Promise<unknown>[] = [];
  let ended = false;

  const native = (el: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    if (!el) return;
    const a = el.animate(keyframes, { fill: 'both', ...options });
    stops.push({
      finish: () => {
        try {
          a.finish();
        } catch {
          // Already finished.
        }
      },
      cancel: () => {
        a.cancel();
      },
    });
    waits.push(a.finished.catch(() => undefined));
  };

  const spring = (
    el: Element | null,
    keyframes: Record<string, string | number | (string | number)[]>,
    visualDuration: number,
    bounce: number,
    delayMs: number,
  ) => {
    if (!el) return;
    const c = animate(el, keyframes, {
      type: 'spring',
      visualDuration,
      bounce,
      delay: delayMs / 1000,
    });
    stops.push({
      finish: () => {
        c.complete();
      },
      cancel: () => {
        c.cancel();
      },
    });
    waits.push(c.finished.catch(() => undefined));
  };

  const hide = (el: Element | null) => {
    if (el instanceof HTMLElement || el instanceof SVGElement) el.style.opacity = '0';
  };
  const dashSetup = (path: SVGPathElement | null): number => {
    if (!path) return 0;
    const len = Math.max(1, path.getTotalLength());
    path.style.strokeDasharray = String(len);
    return len;
  };

  if (variant === 'reduced') {
    native(p.card, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED.fade, easing: EASE_OUT });
    native(p.tetherGroup, [{ opacity: 0 }, { opacity: 1 }], {
      duration: REDUCED.fade,
      easing: EASE_OUT,
    });
  } else if (variant === 'short') {
    p.card.style.transformOrigin = p.cardOrigin;
    native(
      p.card,
      [
        { opacity: 0, transform: 'scale(0.96)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: SHORT.card, easing: EASE_OUT },
    );
    const len = dashSetup(p.tetherLine);
    if (p.tetherLine) {
      native(p.tetherLine, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
        duration: SHORT.tether,
        easing: EASE_OUT,
      });
    }
    native(p.tetherGlow, [{ opacity: 0 }, { opacity: 1 }], {
      duration: SHORT.tether,
      easing: EASE_OUT,
    });
  } else {
    // Full flight. Initial hidden states are set before the first paint by the caller's layout
    // effect; here they are made explicit so a re-run is also correct.
    hide(p.card);
    hide(p.tetherGroup);
    p.chips.forEach(hide);
    hide(p.fine);
    p.card.style.transformOrigin = p.cardOrigin;

    const T = SIGNATURE;
    const flightMs = T.flightEnd - T.flightStart;

    if (p.clone && p.flightD) {
      p.clone.style.offsetPath = `path("${p.flightD}")`;
      // Lift (0-120): rise 4px, scale 1.02, shadow in.
      native(p.clone, [{ translate: '0 0' }, { translate: '0 -4px' }], {
        duration: T.lift,
        easing: EASE_OUT,
      });
      native(p.clone, [{ scale: 1 }, { scale: 1.02 }], { duration: T.lift, easing: EASE_OUT });
      native(p.clone, [{ boxShadow: 'none' }, { boxShadow: 'var(--cl-shadow-e4)' }], {
        duration: T.lift,
        easing: EASE_OUT,
      });
      // Flight (80-560): along the bezier while growing to reading size.
      native(
        p.clone,
        [
          { offsetDistance: '0%', transform: 'scale(1)' },
          { offsetDistance: '100%', transform: `scale(${String(p.scaleEnd)})` },
        ],
        { duration: flightMs, delay: T.flightStart, easing: EASE_IN_OUT },
      );
      // Dock (560-680): cross-fade into the real card.
      native(p.clone, [{ opacity: 1 }, { opacity: 0 }], {
        duration: T.dockEnd - T.flightEnd,
        delay: T.flightEnd,
        easing: EASE_OUT,
        fill: 'both',
      });
    }
    if (p.tag) {
      native(p.tag, [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], {
        duration: flightMs,
        delay: T.flightStart,
        easing: 'linear',
      });
    }
    // The long tether strokes in behind the clone, then hands over to the short one.
    const longLen = dashSetup(p.flightPath);
    dashSetup(p.flightGlow);
    if (p.flightPath) {
      native(p.flightPath, [{ strokeDashoffset: longLen }, { strokeDashoffset: 0 }], {
        duration: flightMs,
        delay: T.flightStart,
        easing: EASE_IN_OUT,
      });
      native(p.flightPath, [{ opacity: 1 }, { opacity: 0 }], {
        duration: T.dockEnd - T.flightEnd,
        delay: T.flightEnd,
        easing: EASE_OUT,
      });
    }
    if (p.flightGlow) {
      const len = p.flightGlow.getTotalLength();
      native(p.flightGlow, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
        duration: flightMs,
        delay: T.flightStart,
        easing: EASE_IN_OUT,
      });
      native(p.flightGlow, [{ opacity: 1 }, { opacity: 0 }], {
        duration: T.dockEnd - T.flightEnd,
        delay: T.flightEnd,
        easing: EASE_OUT,
      });
    }
    // Card docks with SPRING.ui.
    spring(
      p.card,
      { opacity: [0, 1], transform: ['scale(0.96)', 'scale(1)'] },
      0.25,
      0.05,
      T.flightEnd,
    );
    // Short tether appears with a single glow pulse.
    native(p.tetherGroup, [{ opacity: 0 }, { opacity: 1 }], {
      duration: T.dockEnd - T.flightEnd,
      delay: T.flightEnd,
      easing: EASE_OUT,
    });
    if (p.tetherGlow) {
      native(
        p.tetherGlow,
        [{ strokeWidth: '6px' }, { strokeWidth: '10px', offset: 0.5 }, { strokeWidth: '6px' }],
        { duration: 240, delay: T.flightEnd, easing: EASE_OUT },
      );
    }
    // Chips pop one by one with SPRING.playful; only the first four animate separately.
    p.chips.forEach((chip, i) => {
      spring(
        chip,
        { opacity: [0, 1], transform: ['translateY(4px) scale(0.9)', 'translateY(0) scale(1)'] },
        0.4,
        0.25,
        chipStartMs(i),
      );
    });
    // Fine print fades in last.
    native(p.fine, [{ opacity: 0 }, { opacity: 1 }], {
      duration: T.finePrintDuration,
      delay: T.finePrintStart,
      easing: EASE_OUT,
    });
  }

  const cleanup = () => {
    if (ended) return;
    ended = true;
    stops.forEach((s) => {
      s.cancel();
    });
    for (const el of [p.card, p.tetherGroup, p.fine, ...p.chips]) {
      if (el) el.style.opacity = '';
    }
    for (const path of [p.tetherLine, p.flightPath, p.flightGlow]) {
      if (path) {
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
      }
    }
    p.card.style.transformOrigin = '';
    // React owns these nodes, so they are hidden rather than removed.
    for (const el of [p.clone, p.tag, p.flightPath, p.flightGlow]) {
      if (el instanceof HTMLElement || el instanceof SVGElement) el.style.display = 'none';
    }
    onEnd();
  };

  const done = Promise.all(waits).then(cleanup);
  return {
    finish: () => {
      stops.forEach((s) => {
        s.finish();
      });
      cleanup();
    },
    cancel: () => {
      cleanup();
    },
    done,
  };
}
