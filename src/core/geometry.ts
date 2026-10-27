// Card placement and tether geometry (DESIGN.md Layout, Tether). Pure: rects in, numbers out.
// The overlay reads live rects, calls these, and writes transforms (ADR 0001 section 5.4).

export interface Point {
  x: number;
  y: number;
}
/** Viewport coordinates. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface Size {
  width: number;
  height: number;
}
export type Side = 'right' | 'left' | 'below' | 'above';

export const CARD_WIDTH = 336;
export const CARD_GAP = 12;
export const VIEWPORT_MARGIN = 16;
export const STICKY_GAP = 8;

export function rectWidth(r: Rect): number {
  return r.right - r.left;
}
export function rectHeight(r: Rect): number {
  return r.bottom - r.top;
}
export function rectCenter(r: Rect): Point {
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}
export function clamp(n: number, lo: number, hi: number): number {
  return hi < lo ? lo : Math.min(hi, Math.max(lo, n));
}

export interface PlaceInput {
  /** The claim box (or the marker box when the claim block is huge). */
  claim: Rect;
  size: Size;
  viewport: Size;
  /** Bottom edge of a detected sticky header, or 0. */
  stickyBottom: number;
  /** Keep this side while it still fits, so the card does not flip while scrolling. */
  prev?: Side;
}

export interface Placement {
  x: number;
  y: number;
  side: Side;
}

/**
 * Right of the claim if there is room, else left, else below, else above (DESIGN.md Layout). The card
 * stays 12px from the claim box, at least 8px under a sticky header and 16px inside the viewport.
 */
export function placeCard(input: PlaceInput): Placement {
  const { claim, size, viewport, stickyBottom } = input;
  const minY = Math.max(VIEWPORT_MARGIN, stickyBottom > 0 ? stickyBottom + STICKY_GAP : 0);
  const maxY = viewport.height - VIEWPORT_MARGIN - size.height;
  const maxX = viewport.width - VIEWPORT_MARGIN - size.width;
  const fits: Record<Side, boolean> = {
    right: claim.right + CARD_GAP + size.width <= viewport.width - VIEWPORT_MARGIN,
    left: claim.left - CARD_GAP - size.width >= VIEWPORT_MARGIN,
    below: claim.bottom + CARD_GAP + size.height <= viewport.height - VIEWPORT_MARGIN,
    above: claim.top - CARD_GAP - size.height >= minY,
  };
  const order: Side[] = ['right', 'left', 'below', 'above'];
  const side: Side =
    (input.prev && fits[input.prev] ? input.prev : undefined) ??
    order.find((s) => fits[s]) ??
    (viewport.width - claim.right >= claim.left ? 'right' : 'left');
  switch (side) {
    case 'right':
      return {
        side,
        x: Math.min(claim.right + CARD_GAP, Math.max(maxX, VIEWPORT_MARGIN)),
        y: clamp(claim.top, minY, maxY),
      };
    case 'left':
      return {
        side,
        x: Math.max(claim.left - CARD_GAP - size.width, VIEWPORT_MARGIN),
        y: clamp(claim.top, minY, maxY),
      };
    case 'below':
      return {
        side,
        x: clamp(claim.left, VIEWPORT_MARGIN, maxX),
        y: clamp(claim.bottom + CARD_GAP, minY, maxY),
      };
    case 'above':
      return {
        side,
        x: clamp(claim.left, VIEWPORT_MARGIN, maxX),
        y: clamp(claim.top - CARD_GAP - size.height, minY, maxY),
      };
  }
}

/**
 * The point on the card edge facing the claim: the tether's arrival point. It is the edge midpoint
 * nudged toward the marker (kept 20px inside the corners), so a claim near the top of a tall card
 * gets a short, nearly straight leader line instead of one that sags to the card's middle.
 */
export function cardDockPoint(p: Placement, size: Size, toward?: Point): Point {
  const along = (target: number | undefined, start: number, len: number) =>
    target === undefined ? start + len / 2 : clamp(target, start + 20, start + len - 20);
  switch (p.side) {
    case 'right':
      return { x: p.x, y: along(toward?.y, p.y, size.height) };
    case 'left':
      return { x: p.x + size.width, y: along(toward?.y, p.y, size.height) };
    case 'below':
      return { x: along(toward?.x, p.x, size.width), y: p.y };
    case 'above':
      return { x: along(toward?.x, p.x, size.width), y: p.y + size.height };
  }
}

/** Where the tether leaves the marker: its edge facing the card. */
export function markerExitPoint(marker: Rect, side: Side): Point {
  const c = rectCenter(marker);
  switch (side) {
    case 'right':
      return { x: marker.right, y: c.y };
    case 'left':
      return { x: marker.left, y: c.y };
    case 'below':
      return { x: c.x, y: marker.bottom };
    case 'above':
      return { x: c.x, y: marker.top };
  }
}

export interface Bezier {
  p0: Point;
  c1: Point;
  c2: Point;
  p1: Point;
}

/**
 * Cubic bezier whose control points sit 40% of the distance along the leave and arrive directions,
 * so the line leaves and arrives horizontally (vertically for cards placed above or below). Long
 * flights cap the offset so the curve stays on screen.
 */
export function tetherCurve(from: Point, to: Point, side: Side): Bezier {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const off = clamp(dist * 0.4, 12, 180);
  if (side === 'below' || side === 'above') {
    const dir = side === 'below' ? 1 : -1;
    return {
      p0: from,
      c1: { x: from.x, y: from.y + dir * off },
      c2: { x: to.x, y: to.y - dir * off },
      p1: to,
    };
  }
  const dir = side === 'right' ? 1 : -1;
  return {
    p0: from,
    c1: { x: from.x + dir * off, y: from.y },
    c2: { x: to.x - dir * off, y: to.y },
    p1: to,
  };
}

const r2 = (n: number) => String(Math.round(n * 100) / 100);

/** SVG path data for a bezier ("M x y C x y x y x y"). */
export function bezierPath(b: Bezier): string {
  return `M${r2(b.p0.x)} ${r2(b.p0.y)}C${r2(b.c1.x)} ${r2(b.c1.y)} ${r2(b.c2.x)} ${r2(b.c2.y)} ${r2(b.p1.x)} ${r2(b.p1.y)}`;
}

export function bezierPoint(b: Bezier, t: number): Point {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * b.p0.x + w1 * b.c1.x + w2 * b.c2.x + w3 * b.p1.x,
    y: w0 * b.p0.y + w1 * b.c1.y + w2 * b.c2.y + w3 * b.p1.y,
  };
}

/**
 * Where a flight that starts at a footnote begins. A footnote inside the viewport starts at its own
 * top-left; one outside starts at the nearest viewport edge at the footnote's x (DESIGN.md flight).
 */
export function flightStart(footnote: Rect, viewport: Size): { point: Point; onScreen: boolean } {
  const onScreen = footnote.bottom > 0 && footnote.top < viewport.height;
  if (onScreen) {
    return {
      point: { x: footnote.left, y: clamp(footnote.top, 0, viewport.height) },
      onScreen,
    };
  }
  return {
    point: {
      x: clamp(footnote.left, VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN),
      y: footnote.top >= viewport.height ? viewport.height - 8 : 8,
    },
    onScreen,
  };
}

/** Reading size over the footnote's own font size, so a 9px footnote scales 1 to 1.44. */
export function flightScale(fontPx: number | null, readingPx = 13): number {
  if (!fontPx || fontPx <= 0) return 1;
  return clamp(readingPx / fontPx, 1, 2.4);
}
