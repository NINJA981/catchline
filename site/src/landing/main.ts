// Landing page behavior: the hero's footnote flight, the commands copy button, the live privacy
// proof and the offline worker. The page is complete without any of it (the hero paints in its
// settled state from the server HTML).

import {
  cardDockPoint,
  chooseVariant,
  markerExitPoint,
  tetherCurve,
  type Rect,
  type Side,
} from '@catchline/core';
import { reducedMotion } from '../shared/dom';
import { playMoment, type Moment } from '../shared/flight';
import { registerServiceWorker } from '../shared/sw';
import { createTether, setTether } from '../shared/tether';

function must<T extends Element>(
  selector: string,
  kind: abstract new () => T,
  root: ParentNode = document,
): T {
  const el = root.querySelector(selector);
  if (!(el instanceof kind)) throw new Error(`Missing element: ${selector}`);
  return el;
}

function idle(fn: () => void, timeout = 2000): void {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 200);
}

function initHero(): void {
  const stage = must('#stage', HTMLElement);
  const marker = must('#marker', HTMLElement);
  const card = must('#hero-card', HTMLElement);
  const footnote = must('#footnote', HTMLElement);
  const replay = must('#replay', HTMLButtonElement);
  const tether = createTether();
  stage.prepend(tether.svg);

  let side: Side = 'right';
  let moment: Moment | null = null;

  const rel = (el: Element): Rect => {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      left: r.left - s.left - stage.clientLeft,
      top: r.top - s.top - stage.clientTop,
      right: r.right - s.left - stage.clientLeft,
      bottom: r.bottom - s.top - stage.clientTop,
    };
  };

  const layout = (): void => {
    const m = rel(marker);
    const cs = rel(card);
    side = cs.left >= m.right + 8 ? 'right' : 'below';
    const size = { width: cs.right - cs.left, height: cs.bottom - cs.top };
    const from = markerExitPoint(m, side);
    const to = cardDockPoint({ x: cs.left, y: cs.top, side }, size);
    setTether(tether, tetherCurve(from, to, side));
  };

  const play = (forced: boolean): void => {
    moment?.finish();
    layout();
    marker.setAttribute('aria-expanded', 'true');
    footnote.classList.add('ghost');
    const variant = forced
      ? reducedMotion()
        ? 'reduced'
        : 'flight'
      : chooseVariant({ reducedMotion: reducedMotion(), firstOpen: true });
    moment = playMoment(
      {
        stage,
        card,
        chips: Array.from(card.querySelectorAll<HTMLElement>('.chip')),
        fine: card.querySelector<HTMLElement>('.fine'),
        footnote,
        footnoteFontPx: 11,
        footnoteText: footnote.textContent.replace(/\s+/g, ' ').trim(),
        tether,
        side,
      },
      variant,
    );
  };

  layout();
  void document.fonts.ready.then(layout);
  new ResizeObserver(() => {
    layout();
  }).observe(stage);

  replay.addEventListener('click', () => {
    play(true);
  });
  marker.addEventListener('click', () => {
    play(true);
  });

  // Play once, after load and idle, when the specimen is actually on screen. Reduced motion keeps
  // the settled frame: no autoplay, and Replay fades instead of flying.
  if (!reducedMotion()) {
    const start = (): void => {
      idle(() => {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              io.disconnect();
              play(false);
            }
          },
          { threshold: 0.6 },
        );
        io.observe(stage);
      });
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }
}

function initCopy(): void {
  const button = document.querySelector<HTMLButtonElement>('#copy-commands');
  const code = document.querySelector<HTMLElement>('#commands');
  if (!button || !code) return;
  const label = must('span', HTMLElement, button);
  const original = label.textContent;
  button.addEventListener('click', () => {
    const text = code.textContent;
    const done = (ok: boolean): void => {
      label.textContent = ok ? 'Copied' : 'Press Ctrl+C to copy';
      window.setTimeout(() => {
        label.textContent = original;
      }, 1500);
    };
    navigator.clipboard.writeText(text).then(
      () => {
        done(true);
      },
      () => {
        const range = document.createRange();
        range.selectNodeContents(code);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        done(false);
      },
    );
  });
}

const NBSP = String.fromCharCode(160);

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)}${NBSP}KB`;
}

function initProof(): void {
  const own = document.querySelector<HTMLElement>('#proof-own');
  const other = document.querySelector<HTMLElement>('#proof-other');
  if (!own || !other) return;
  const count = (): void => {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let ownCount = 1; // the page itself
    let otherCount = 0;
    let bytes = 0;
    for (const e of entries) {
      let sameOrigin: boolean;
      try {
        sameOrigin = new URL(e.name).origin === location.origin;
      } catch {
        sameOrigin = false;
      }
      if (sameOrigin) {
        ownCount++;
        bytes += e.encodedBodySize;
      } else {
        otherCount++;
      }
    }
    own.textContent = `${String(ownCount)} files, ${formatKb(bytes)}`;
    other.textContent = String(otherCount);
  };
  const run = (): void => {
    window.setTimeout(count, 600);
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

initHero();
initCopy();
initProof();
registerServiceWorker('./sw.js');
