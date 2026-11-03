import {
  CARD_GAP,
  CARD_WIDTH,
  STICKY_GAP,
  VIEWPORT_MARGIN,
  bezierPath,
  bezierPoint,
  cardDockPoint,
  chipStartMs,
  chooseVariant,
  cubicBezierEase,
  flightScale,
  flightStart,
  layoutShare,
  ledgerRows,
  markerExitPoint,
  placeCard,
  rebaseSpans,
  buildRollup,
  segmentText,
  splitFigures,
  ringBox,
  tetherCurve,
  wrapLines,
  SHARE,
  SIGNATURE,
} from '../../src/core';
import { analyzeFixture } from './helpers';

const vp = { width: 1440, height: 900 };
const size = { width: CARD_WIDTH, height: 320 };
const claim = { left: 40, top: 150, right: 200, bottom: 190 };

describe('placeCard (DESIGN.md Layout)', () => {
  it('prefers the right side, 12px from the claim', () => {
    const p = placeCard({ claim, size, viewport: vp, stickyBottom: 0 });
    expect(p.side).toBe('right');
    expect(p.x).toBe(claim.right + CARD_GAP);
    expect(p.y).toBe(150);
  });

  it('falls back to the left, then below, then above', () => {
    const right = { left: 1200, top: 150, right: 1400, bottom: 190 };
    expect(placeCard({ claim: right, size, viewport: vp, stickyBottom: 0 }).side).toBe('left');
    const wide = { left: 20, top: 100, right: 1420, bottom: 140 };
    expect(placeCard({ claim: wide, size, viewport: vp, stickyBottom: 0 }).side).toBe('below');
    const low = { left: 20, top: 700, right: 1420, bottom: 740 };
    expect(placeCard({ claim: low, size, viewport: vp, stickyBottom: 0 }).side).toBe('above');
  });

  it('stays 16px inside the viewport and 8px under a sticky header', () => {
    const nearBottom = { left: 40, top: 800, right: 200, bottom: 840 };
    const p = placeCard({ claim: nearBottom, size, viewport: vp, stickyBottom: 0 });
    expect(p.y + size.height).toBeLessThanOrEqual(vp.height - VIEWPORT_MARGIN);
    const top = placeCard({
      claim: { ...claim, top: 20, bottom: 60 },
      size,
      viewport: vp,
      stickyBottom: 64,
    });
    expect(top.y).toBeGreaterThanOrEqual(64 + STICKY_GAP);
  });

  it('keeps the previous side while it still fits (no flipping while scrolling)', () => {
    const p = placeCard({ claim, size, viewport: vp, stickyBottom: 0, prev: 'below' });
    expect(p.side).toBe('below');
  });

  it('never leaves the viewport on a 375px phone', () => {
    const phone = { width: 375, height: 812 };
    const p = placeCard({
      claim: { left: 16, top: 200, right: 120, bottom: 224 },
      size: { width: 336, height: 300 },
      viewport: phone,
      stickyBottom: 0,
    });
    expect(p.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
    expect(p.x + 336).toBeLessThanOrEqual(phone.width - VIEWPORT_MARGIN + 1);
  });
});

describe('tether geometry', () => {
  it('docks at the card edge nearest the marker, 20px inside the corners', () => {
    const place = { x: 212, y: 150, side: 'right' as const };
    expect(cardDockPoint(place, size)).toEqual({ x: 212, y: 310 });
    expect(cardDockPoint(place, size, { x: 200, y: 160 })).toEqual({ x: 212, y: 170 });
    expect(cardDockPoint(place, size, { x: 200, y: 900 }).y).toBe(150 + 320 - 20);
    expect(cardDockPoint({ x: 100, y: 300, side: 'below' }, size, { x: 90, y: 280 }).x).toBe(120);
  });

  it('leaves the marker edge facing the card', () => {
    const m = { left: 100, top: 100, right: 110, bottom: 120 };
    expect(markerExitPoint(m, 'right')).toEqual({ x: 110, y: 110 });
    expect(markerExitPoint(m, 'left')).toEqual({ x: 100, y: 110 });
    expect(markerExitPoint(m, 'below')).toEqual({ x: 105, y: 120 });
  });

  it('leaves and arrives horizontally for side placements, 40% of the distance out', () => {
    const b = tetherCurve({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right');
    expect(b.c1).toEqual({ x: 40, y: 0 });
    expect(b.c2).toEqual({ x: 60, y: 0 });
    const v = tetherCurve({ x: 0, y: 0 }, { x: 0, y: 100 }, 'below');
    expect(v.c1.x).toBe(0);
    expect(v.c2.x).toBe(0);
  });

  it('keeps the control points between the endpoints when the card sits just below the claim', () => {
    const b = tetherCurve({ x: 0, y: 0 }, { x: 100, y: 20 }, 'below');
    expect(b.c1.y).toBeGreaterThanOrEqual(0);
    expect(b.c1.y).toBeLessThanOrEqual(20);
    expect(b.c2.y).toBeGreaterThanOrEqual(0);
    expect(b.c2.y).toBeLessThanOrEqual(20);
    const up = tetherCurve({ x: 0, y: 0 }, { x: 100, y: -20 }, 'above');
    expect(up.c1.y).toBeLessThanOrEqual(0);
    expect(up.c1.y).toBeGreaterThanOrEqual(-20);
    expect(up.c2.y).toBeLessThanOrEqual(0);
    expect(up.c2.y).toBeGreaterThanOrEqual(-20);
  });

  it('draws the open ring as a square around a tall glyph box, never a capsule', () => {
    const tall = ringBox({ left: 100, top: 100, right: 134, bottom: 176 });
    expect(tall.right - tall.left).toBe(tall.bottom - tall.top);
    expect((tall.left + tall.right) / 2).toBe(117);
    const small = ringBox({ left: 10, top: 10, right: 20, bottom: 26 });
    expect(small.right - small.left).toBe(18);
    expect(small.bottom - small.top).toBe(20);
  });

  it('caps the control offset on long flights so the curve stays on screen', () => {
    const b = tetherCurve({ x: 0, y: 0 }, { x: 100, y: 3000 }, 'right');
    expect(b.c1.x).toBeLessThanOrEqual(180);
  });

  it('serialises and samples the curve', () => {
    const b = tetherCurve({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right');
    expect(bezierPath(b)).toBe('M0 0C40 0 60 0 100 0');
    expect(bezierPoint(b, 0)).toEqual({ x: 0, y: 0 });
    expect(bezierPoint(b, 1)).toEqual({ x: 100, y: 0 });
    expect(bezierPoint(b, 0.5).x).toBeCloseTo(50);
  });

  it('starts the flight at the viewport edge when the footnote is off screen', () => {
    const below = flightStart({ left: 8, top: 3000, right: 900, bottom: 3020 }, vp);
    expect(below.onScreen).toBe(false);
    expect(below.point.y).toBe(vp.height - 8);
    const on = flightStart({ left: 8, top: 500, right: 900, bottom: 520 }, vp);
    expect(on).toEqual({ onScreen: true, point: { x: 8, y: 500 } });
  });

  it('scales a 9px footnote to reading size: 1 to 1.44', () => {
    expect(flightScale(9)).toBeCloseTo(1.444, 3);
    expect(flightScale(13)).toBe(1);
    expect(flightScale(16)).toBe(1);
    expect(flightScale(null)).toBe(1);
  });
});

describe('signature timeline (DESIGN.md)', () => {
  it('picks the variant: reduced motion wins, first open flies, later opens are short', () => {
    expect(chooseVariant({ reducedMotion: true, firstOpen: true })).toBe('reduced');
    expect(chooseVariant({ reducedMotion: false, firstOpen: true })).toBe('flight');
    expect(chooseVariant({ reducedMotion: false, firstOpen: false })).toBe('short');
  });

  it('staggers chips by 80ms from 680ms and animates at most four', () => {
    expect(chipStartMs(0)).toBe(680);
    expect(chipStartMs(1)).toBe(760);
    expect(chipStartMs(2)).toBe(840);
    expect(chipStartMs(9)).toBe(chipStartMs(SIGNATURE.maxAnimatedChips - 1));
  });

  it('adds up: the moment fits in 960ms', () => {
    expect(SIGNATURE.finePrintStart + SIGNATURE.finePrintDuration).toBe(SIGNATURE.total);
    expect(SIGNATURE.flightEnd - SIGNATURE.flightStart).toBe(480);
  });

  it('eases in and out like cubic-bezier(0.77, 0, 0.175, 1)', () => {
    const e = cubicBezierEase(0.77, 0, 0.175, 1);
    expect(e(0)).toBe(0);
    expect(e(1)).toBe(1);
    expect(e(0.1)).toBeLessThan(0.1);
    expect(e(0.9)).toBeGreaterThan(0.9);
    expect(e(0.5)).toBeGreaterThan(0.45);
    expect(e(0.5)).toBeLessThan(0.7);
  });
});

describe('figures, highlights and ledger', () => {
  it('splits every comparable number out of a label', () => {
    expect(splitFigures('$35 activation').map((s) => [s.text, s.figure])).toEqual([
      ['$35', true],
      [' activation', false],
    ]);
    const rate = splitFigures('0% intro APR for 15 months, then 19.24%-29.99% variable');
    expect(rate.filter((s) => s.figure).map((s) => s.text)).toEqual(['0%', '15', '19.24%-29.99%']);
    expect(
      splitFigures('$10/mo after 12 months')
        .filter((s) => s.figure)
        .map((s) => s.text),
    ).toEqual(['$10/mo', '12']);
    expect(splitFigures('Autopay required')).toEqual([{ text: 'Autopay required', figure: false }]);
  });

  it('marks and merges chip spans inside the raw text', () => {
    const parts = segmentText('Pay $35 now. Autopay required.', [
      [4, 7],
      [5, 8],
      [13, 30],
    ]);
    expect(parts.filter((p) => p.mark).map((p) => p.text)).toEqual(['$35 ', 'Autopay required.']);
    expect(parts.map((p) => p.text).join('')).toBe('Pay $35 now. Autopay required.');
    expect(segmentText('plain', [])).toEqual([{ text: 'plain', mark: false }]);
    expect(segmentText('abc', [[5, 9]])).toEqual([{ text: 'abc', mark: false }]);
    expect(rebaseSpans([[10, 14]], 8)).toEqual([[2, 6]]);
  });

  it('builds one-term-per-row ledger rows from a real rollup', () => {
    const rollup = buildRollup(1, analyzeFixture('synthetic/bank-specimen.html').catches, 0);
    const rows = ledgerRows(rollup);
    expect(rows.length).toBeGreaterThan(3);
    expect(rows[0]?.first).toBe(true);
    // The category label shows once per group.
    const firsts = rows.filter((r) => r.first).map((r) => r.category);
    expect(new Set(firsts).size).toBe(firsts.length);
    expect(rows.some((r) => r.category === 'Rates')).toBe(true);
    for (const r of rows) expect(r.value).not.toMatch(/·/);
  });
});

describe('share image layout (SPEC F8, DESIGN.md Share card)', () => {
  // A fixed-width measure: 9px per character, 0.6 of the size.
  const measure = (text: string, px: number) => text.length * px * 0.5;
  const input = {
    claim: '$0/mo*',
    chips: [
      { kind: 'money', label: '$35 activation' },
      { kind: 'time', label: '36-month installment agreement' },
      { kind: 'requirement', label: 'Autopay required' },
    ],
    fine: '*With 36-month installment agreement on the Pixelstone 9 (full retail price $799.99). $35 activation fee. Autopay required.',
    host: 'ridgeline.example',
    date: new Date(2026, 9, 20),
  };

  it('fits 1200x630 with 64px margins and a card at 1.5x', () => {
    const L = layoutShare(measure, input);
    expect(L.card.w).toBe(504);
    expect(L.card.x + L.card.w).toBe(SHARE.width - SHARE.margin);
    expect(L.card.y).toBeGreaterThanOrEqual(SHARE.margin);
    expect(L.card.y + L.card.h).toBeLessThanOrEqual(SHARE.height - SHARE.margin);
    expect(L.claimPx).toBe(64);
    expect(L.footer).toMatchObject({ host: 'ridgeline.example', date: '2026-10-20' });
  });

  it('keeps every chip inside the card and wraps rows', () => {
    const L = layoutShare(measure, input);
    for (const c of L.chips) {
      expect(c.x).toBeGreaterThanOrEqual(L.card.x);
      expect(c.x + c.w).toBeLessThanOrEqual(L.card.x + L.card.w);
    }
    expect(new Set(L.chips.map((c) => c.y)).size).toBeGreaterThan(1);
  });

  it('shrinks a long claim to fit four lines and cuts long fine print with an ellipsis', () => {
    const long = layoutShare(measure, {
      ...input,
      claim: 'word '.repeat(60).trim(),
      fine: 'long sentence '.repeat(200),
    });
    expect(long.claimLines.length).toBeLessThanOrEqual(SHARE.maxClaimLines);
    expect(long.fineLines.length).toBeLessThanOrEqual(SHARE.maxFineLines);
    expect(long.fineLines[long.fineLines.length - 1]?.text.endsWith('…')).toBe(true);
  });

  it('reports chips that did not fit as a count', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      kind: 'money',
      label: `$${String(i + 1)} fee`,
    }));
    expect(layoutShare(measure, { ...input, chips: many }).moreChips).toBe(3);
  });

  it('wraps greedily', () => {
    const r = wrapLines((s) => s.length * 10, 'aaa bbb ccc ddd', 70, 5);
    expect(r.lines).toEqual(['aaa bbb', 'ccc ddd']);
    expect(r.cut).toBe(false);
  });
});
