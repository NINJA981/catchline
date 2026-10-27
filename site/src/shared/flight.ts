// The signature moment: the footnote flight (DESIGN.md "Signature Moment"). Every step is WAAPI,
// timings and geometry come from the shared engine module (src/core/timeline.ts, geometry.ts).
//
//   full    (first open)   960 ms: lift, flight along a bezier, dock, chips pop, fine print fades in
//   short   (later opens)  card 150 ms, tether 120 ms
//   reduced (reduce)       card and tether fade together over 150 ms, no clone, no scale
//
// Final styles are the element's natural styles; animations use fill: 'backwards', so cancelling
// or finishing them leaves the settled state and nothing has to be cleaned up but the clone.

import {
  REDUCED,
  SHORT,
  SIGNATURE,
  bezierPoint,
  chipStartMs,
  clamp,
  cubicBezierEase,
  flightScale,
  flightStart,
  pageOffsetLabel,
  tetherCurve,
  type Bezier,
  type MotionVariant,
  type Point,
  type Side,
} from '@catchline/core';
import { h } from './dom';
import type { Tether } from './tether';

export interface MomentTargets {
  /** Positioned ancestor that holds the tether svg and the flying clone. */
  stage: HTMLElement;
  card: HTMLElement;
  chips: readonly HTMLElement[];
  fine: HTMLElement | null;
  /** Where the footnote lives on the page; null when the catch has no footnote. */
  footnote: HTMLElement | null;
  footnoteFontPx: number | null;
  /** Text the clone shows (the matched footnote text). */
  footnoteText: string;
  tether: Tether;
  /** Which side of the claim the card is on. */
  side: Side;
}

export interface Moment {
  finished: Promise<void>;
  finish(): void;
}

const EASE_FLIGHT = cubicBezierEase(0.77, 0, 0.175, 1);
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const EASE_POP = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const SAMPLES = 36;

function origin(side: Side): string {
  switch (side) {
    case 'right':
      return 'left center';
    case 'left':
      return 'right center';
    case 'below':
      return 'center top';
    case 'above':
      return 'center bottom';
  }
}

function relPoint(p: Point, stage: HTMLElement): Point {
  const r = stage.getBoundingClientRect();
  return { x: p.x - r.left - stage.clientLeft, y: p.y - r.top - stage.clientTop };
}

function anim(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation {
  return el.animate(keyframes, { fill: 'backwards', ...options });
}

function settled(animations: readonly Animation[]): Moment {
  return {
    finished: Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(
      () => undefined,
    ),
    finish() {
      for (const a of animations) {
        try {
          a.finish();
        } catch {
          // already settled or cancelled
        }
      }
    },
  };
}

function drawIn(t: Tether, duration: number, delay: number, easing: string): Animation[] {
  const frames: Keyframe[] = [{ strokeDashoffset: -1 }, { strokeDashoffset: 0 }];
  return [
    anim(t.glow, frames, { duration, delay, easing }),
    anim(t.line, frames, { duration, delay, easing }),
    anim(t.dot, [{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(duration, 80), delay }),
  ];
}

function fade(el: Element, duration: number): Animation {
  return anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE_OUT });
}

export function playMoment(t: MomentTargets, variant: MotionVariant): Moment {
  const { card, tether } = t;
  if (variant === 'reduced') {
    return settled([fade(card, REDUCED.fade), fade(tether.svg, REDUCED.fade)]);
  }
  card.style.transformOrigin = origin(t.side);
  if (variant === 'short') {
    return settled([
      anim(
        card,
        [
          { opacity: 0, transform: 'scale(0.96)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: SHORT.card, easing: EASE_OUT },
      ),
      ...drawIn(tether, SHORT.tether, 0, EASE_OUT),
    ]);
  }
  return playFlight(t);
}

function playFlight(t: MomentTargets): Moment {
  const { stage, card, tether } = t;
  const S = SIGNATURE;
  const all: Animation[] = [];
  const cardRect = card.getBoundingClientRect();
  const fineRect = (t.fine ?? card).getBoundingClientRect();
  const fnRect = t.footnote?.getBoundingClientRect();
  let clone: HTMLElement | null = null;

  // The card itself: hidden until the dock (560 ms), then scale 0.96 to 1 over 120 ms.
  all.push(
    anim(
      card,
      [
        { opacity: 0, transform: 'scale(0.96)', offset: 0 },
        { opacity: 0, transform: 'scale(0.96)', offset: S.flightEnd / S.dockEnd },
        { opacity: 1, transform: 'scale(1)', offset: 1 },
      ],
      { duration: S.dockEnd, easing: EASE_OUT },
    ),
  );
  all.push(
    ...drawIn(
      tether,
      S.flightEnd - S.flightStart,
      S.flightStart,
      'cubic-bezier(0.77, 0, 0.175, 1)',
    ),
  );
  // The glow pulses once as the card docks.
  all.push(
    anim(tether.glow, [{ strokeWidth: '6px' }, { strokeWidth: '9px' }, { strokeWidth: '6px' }], {
      duration: S.dockEnd - S.flightEnd,
      delay: S.flightEnd,
      easing: EASE_OUT,
      fill: 'none',
    }),
  );

  if (fnRect && fnRect.width > 0 && t.footnoteText) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const start = flightStart(
      { left: fnRect.left, top: fnRect.top, right: fnRect.right, bottom: fnRect.bottom },
      viewport,
    );
    const from = relPoint(start.point, stage);
    const to = relPoint({ x: fineRect.left, y: fineRect.top }, stage);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const side: Side =
      Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'above' : 'below') : dx > 0 ? 'right' : 'left';
    const path: Bezier = tetherCurve(from, to, side);
    const scale = flightScale(t.footnoteFontPx);
    const width = Math.min(fnRect.width, Math.max(160, fineRect.width / scale));

    const el = h('p', { class: 'flight', 'aria-hidden': 'true' }, t.footnoteText);
    el.style.width = `${String(Math.round(width))}px`;
    el.style.fontSize = `${String(t.footnoteFontPx ?? 11)}px`;
    el.style.lineHeight = '1.4';
    if (!start.onScreen) {
      el.append(h('span', { class: 'flight__tag' }, pageOffsetLabel(fnRect.top - cardRect.top)));
    }
    stage.appendChild(el);
    clone = el;

    const frames: Keyframe[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const ms = (i / SAMPLES) * S.flightEnd;
      const lift = EASE_FLIGHT(clamp(ms / S.lift, 0, 1));
      const e = EASE_FLIGHT(clamp((ms - S.flightStart) / (S.flightEnd - S.flightStart), 0, 1));
      const p = bezierPoint(path, e);
      const sc = (1 + (scale - 1) * e) * (1 + 0.02 * lift * (1 - e));
      frames.push({
        offset: i / SAMPLES,
        transform: `translate(${p.x.toFixed(1)}px, ${(p.y - 4 * lift * (1 - e)).toFixed(1)}px) scale(${sc.toFixed(3)})`,
      });
    }
    all.push(el.animate(frames, { duration: S.flightEnd, easing: 'linear', fill: 'both' }));
    all.push(
      el.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: S.flightEnd / S.dockEnd },
          { opacity: 0, offset: 1 },
        ],
        { duration: S.dockEnd, easing: 'linear', fill: 'both' },
      ),
    );
    all.push(
      el.animate([{ boxShadow: 'none' }, { boxShadow: 'var(--cl-shadow-e4)' }], {
        duration: S.lift,
        easing: EASE_OUT,
        fill: 'both',
      }),
    );
  }

  // Chips pop in one by one (the fifth and later arrive with the fourth).
  t.chips.forEach((chip, i) => {
    all.push(
      anim(
        chip,
        [
          { opacity: 0, transform: 'translateY(4px) scale(0.9)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 300, delay: chipStartMs(i), easing: EASE_POP },
      ),
    );
  });
  if (t.fine) {
    all.push(
      anim(t.fine, [{ opacity: 0 }, { opacity: 1 }], {
        duration: S.finePrintDuration,
        delay: S.finePrintStart,
        easing: EASE_OUT,
      }),
    );
  }

  const moment = settled(all);
  void moment.finished.then(() => {
    clone?.remove();
  });
  const finishAll = moment.finish.bind(moment);
  moment.finish = () => {
    finishAll();
    clone?.remove();
  };
  return moment;
}
