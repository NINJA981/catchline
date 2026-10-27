// One open catch: ring, claim wash, ghost outline, tether, flight and card. Geometry is read from
// live rects once per frame and written back as transforms in the same frame (read all, then write
// all), so the page never reflows and the endpoints stay within a pixel of the claim and card
// edges while the page scrolls, resizes or carries a sticky header (SPEC AC-F5.1).

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  bezierPath,
  cardDockPoint,
  flightScale,
  flightStart,
  markerExitPoint,
  pageOffsetLabel,
  placeCard,
  tetherCurve,
  type MotionVariant,
  type Side,
} from '../core';
import { elementRect, fontSizeOf, claimRect, markerRect, stickyHeaderBottom } from '../dom/rects';
import { CardContent } from './CardContent';
import { play, type Playback } from './flight';
import type { CatchModel } from './model';

interface Props {
  model: CatchModel;
  hostname: string;
  variant: MotionVariant;
  looking: boolean;
  onClose: () => void;
  /** The marker disappeared from the page (re-render, navigation). */
  onLost: () => void;
  announce: (text: string) => void;
  styleRoot: () => Element | null;
}

const ORIGIN: Record<Side, string> = {
  right: '0% 50%',
  left: '100% 50%',
  below: '50% 0%',
  above: '50% 100%',
};

export function CardLayer({
  model,
  hostname,
  variant,
  looking,
  onClose,
  onLost,
  announce,
  styleRoot,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const flightPathRef = useRef<SVGPathElement>(null);
  const flightGlowRef = useRef<SVGPathElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLElement | null>(null);
  const side = useRef<Side | undefined>(undefined);
  const sticky = useRef(0);
  const frame = useRef(0);
  const lost = useRef(0);
  const flying = useRef<Playback | null>(null);
  const last = useRef<{
    dock: { x: number; y: number };
    place: { x: number; y: number; side: Side };
  } | null>(null);
  const headingId = `cl-claim-${model.id}`;

  /** Read every rect, then write every transform. */
  const tick = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    frame.current += 1;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const m = markerRect(model.marker);
    const claim = claimRect(model.marker, m);
    const fn = elementRect(model.footnoteEl());
    if (frame.current % 10 === 1) sticky.current = stickyHeaderBottom();
    const size = { width: card.offsetWidth, height: card.offsetHeight };
    if (!m || !claim) {
      lost.current += 1;
      if (lost.current > 20) onLost();
      return;
    }
    lost.current = 0;
    const place = placeCard({
      claim,
      size,
      viewport: { width: vw, height: vh },
      stickyBottom: sticky.current,
      prev: side.current,
    });
    side.current = place.side;
    const exit = markerExitPoint(m, place.side);
    const dock = cardDockPoint(place, size, exit);
    const d = bezierPath(tetherCurve(exit, dock, place.side));
    last.current = { dock, place };

    // Writes.
    card.style.translate = `${String(Math.round(place.x))}px ${String(Math.round(place.y))}px`;
    glowRef.current?.setAttribute('d', d);
    lineRef.current?.setAttribute('d', d);
    dotRef.current?.setAttribute('cx', String(exit.x));
    dotRef.current?.setAttribute('cy', String(exit.y));
    const ring = ringRef.current;
    if (ring) {
      ring.style.width = `${String(m.right - m.left + 8)}px`;
      ring.style.height = `${String(Math.max(m.bottom - m.top, 16) + 4)}px`;
      ring.style.translate = `${String(m.left - 4)}px ${String(m.top - 2)}px`;
    }
    const wash = washRef.current;
    if (wash) {
      wash.style.width = `${String(claim.right - claim.left)}px`;
      wash.style.height = `${String(claim.bottom - claim.top)}px`;
      wash.style.translate = `${String(claim.left)}px ${String(claim.top)}px`;
    }
    const ghost = ghostRef.current;
    if (ghost) {
      if (fn) {
        ghost.style.display = '';
        ghost.style.width = `${String(fn.right - fn.left + 8)}px`;
        ghost.style.height = `${String(fn.bottom - fn.top + 8)}px`;
        ghost.style.translate = `${String(fn.left - 4)}px ${String(fn.top - 4)}px`;
      } else {
        ghost.style.display = 'none';
      }
    }
  }, [model, onLost]);

  // Mount: place first, then start the motion before the first paint.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    tick();
    const geometry = last.current;
    const fnRect = elementRect(model.footnoteEl());
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let v: MotionVariant = variant;
    if (v === 'flight' && (!fnRect || !geometry || model.shownText === null)) v = 'short';
    const chips = Array.from(card.querySelectorAll<HTMLElement>('[data-chip-index]'));
    const fine = card.querySelector<HTMLElement>('[data-fine]');
    let flightD: string | null = null;
    let scaleEnd = 1;
    if (v === 'flight' && fnRect && geometry) {
      const start = flightStart(fnRect, { width: vw, height: vh });
      const curve = tetherCurve(start.point, geometry.dock, geometry.place.side);
      flightD = bezierPath(curve);
      flightPathRef.current?.setAttribute('d', flightD);
      flightGlowRef.current?.setAttribute('d', flightD);
      const fontPx = fontSizeOf(model.footnoteEl()) ?? 13;
      scaleEnd = flightScale(fontPx);
      const clone = cloneRef.current;
      if (clone) {
        const px = Math.min(fontPx, 13);
        clone.style.fontSize = `${String(px)}px`;
        clone.style.lineHeight = `${String((px * 20) / 13)}px`;
        clone.style.width = `${String(304 / scaleEnd)}px`;
        clone.style.maxHeight = `${String(150 / scaleEnd)}px`;
        clone.style.transformOrigin = ORIGIN[geometry.place.side];
        clone.style.offsetAnchor = ORIGIN[geometry.place.side];
      }
      const tag = tagRef.current;
      if (tag) {
        if (!start.onScreen) {
          tag.textContent = pageOffsetLabel(
            fnRect.top - (claimRect(model.marker, markerRect(model.marker))?.top ?? 0),
          );
          const flip = start.point.y > vh / 2;
          tag.style.translate = `${String(start.point.x)}px ${String(start.point.y + (flip ? -28 : 12))}px`;
        } else {
          tag.style.display = 'none';
        }
      }
    } else {
      for (const el of [
        cloneRef.current,
        tagRef.current,
        flightPathRef.current,
        flightGlowRef.current,
      ]) {
        if (el) el.style.display = 'none';
      }
    }
    const playback = play(
      v,
      {
        card,
        chips,
        fine,
        tetherGroup: groupRef.current,
        tetherLine: lineRef.current,
        tetherGlow: glowRef.current,
        flightPath: v === 'flight' ? flightPathRef.current : null,
        flightGlow: v === 'flight' ? flightGlowRef.current : null,
        clone: v === 'flight' ? cloneRef.current : null,
        tag: v === 'flight' ? tagRef.current : null,
        flightD,
        scaleEnd,
        cardOrigin: ORIGIN[geometry?.place.side ?? 'right'],
      },
      () => {
        flying.current = null;
      },
    );
    flying.current = playback;
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      playback.cancel();
    };
    // The motion runs once per open card; tick is stable for a given model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One rAF loop while the card is open.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // Scrolling or resizing mid-flight jumps to the end state (DESIGN.md Interruptions).
    const interrupt = () => {
      flying.current?.finish();
    };
    window.addEventListener('scroll', interrupt, { capture: true, passive: true });
    window.addEventListener('resize', interrupt, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', interrupt, { capture: true });
      window.removeEventListener('resize', interrupt);
    };
  }, [tick]);

  const finishFlight = useCallback(() => {
    flying.current?.finish();
  }, []);

  return (
    <>
      <div ref={washRef} className="cl-claimwash" aria-hidden />
      <div ref={ghostRef} className="cl-ghost" aria-hidden />
      <div ref={ringRef} className="cl-ring" aria-hidden />
      <svg className="cl-svg" aria-hidden>
        <path ref={flightGlowRef} className="cl-tether-glow" />
        <path ref={flightPathRef} className="cl-tether-line" />
        <g ref={groupRef} className="cl-tether" data-selected="false">
          <path ref={glowRef} className="cl-tether-glow" />
          <path ref={lineRef} className="cl-tether-line" />
          <circle ref={dotRef} className="cl-tether-dot" r={2} />
        </g>
      </svg>
      {variant === 'flight' && model.shownText !== null && (
        <>
          <div ref={cloneRef} className="cl-clone" aria-hidden>
            {model.shownText}
          </div>
          <div ref={tagRef} className="cl-offset-tag" aria-hidden />
        </>
      )}
      <div
        ref={cardRef}
        className="cl-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby={headingId}
        tabIndex={-1}
        data-catch-id={model.id}
        onPointerDown={finishFlight}
      >
        <CardContent
          model={model}
          hostname={hostname}
          styleRoot={styleRoot}
          looking={looking}
          headingId={headingId}
          headingRef={(el) => {
            headingRef.current = el;
          }}
          onClose={onClose}
          announce={announce}
        />
      </div>
    </>
  );
}
