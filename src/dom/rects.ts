// Live geometry reads for the overlay and the marker layer (ADR 0001 section 5.4). Every function
// here only reads layout; callers read first and write afterwards to avoid thrashing.

import type { Marker, Rect } from '../core';

function toRect(r: DOMRect): Rect {
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function usable(r: DOMRect): boolean {
  return r.width > 0 || r.height > 0;
}

/** The marker glyph's box in viewport coordinates, or null when it cannot be measured. */
export function markerRect(marker: Marker): Rect | null {
  const a = marker.anchor;
  const node = a?.node.deref();
  if (a && node?.isConnected) {
    try {
      const range = document.createRange();
      range.setStart(node, Math.min(a.start, node.length));
      range.setEnd(node, Math.min(a.end, node.length));
      const r = range.getBoundingClientRect();
      if (usable(r)) return toRect(r);
    } catch {
      // The text node changed under us; fall through to the element.
    }
  }
  const el = marker.markerEl?.deref();
  if (el?.isConnected) {
    const r = el.getBoundingClientRect();
    if (usable(r)) return toRect(r);
  }
  const claim = marker.claimEl.deref();
  if (claim?.isConnected) {
    const r = claim.getBoundingClientRect();
    if (usable(r)) return { left: r.left, top: r.top, right: r.left + 1, bottom: r.bottom };
  }
  return null;
}

/**
 * The box the card sits beside and the claim wash covers: from the left edge of the claim block to
 * the marker, on the marker's line. A full-width block (a hero price, a paragraph) would otherwise
 * push the card to the far side of the page and tint the whole row.
 */
export function claimRect(marker: Marker, mRect: Rect | null): Rect | null {
  if (!mRect) return null;
  const el = marker.claimEl.deref();
  let left = mRect.left - 4;
  if (el?.isConnected) {
    const r = el.getBoundingClientRect();
    if (usable(r) && r.left < mRect.left) left = Math.max(r.left, mRect.left - 640);
  }
  return { left, top: mRect.top - 2, right: mRect.right + 4, bottom: mRect.bottom + 2 };
}

export function elementRect(el: Element | null | undefined): Rect | null {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  return usable(r) ? toRect(r) : null;
}

/**
 * Bottom edge of a sticky or fixed header pinned to the top of the viewport (at least 40px tall), so
 * the card can sit clear of it. Probes three points near the top edge.
 */
export function stickyHeaderBottom(): number {
  let bottom = 0;
  const w = window.innerWidth;
  for (const x of [w * 0.2, w * 0.5, w * 0.8]) {
    let el: Element | null = document.elementFromPoint(x, 2);
    while (el && el !== document.documentElement && el !== document.body) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') {
        const r = el.getBoundingClientRect();
        if (r.height >= 40 && r.top <= 2 && r.bottom < window.innerHeight * 0.4) {
          bottom = Math.max(bottom, r.bottom);
        }
        break;
      }
      el = el.parentElement;
    }
  }
  return bottom;
}

export function fontSizeOf(el: Element | null | undefined): number | null {
  if (!el?.isConnected) return null;
  const px = parseFloat(getComputedStyle(el).fontSize);
  return Number.isFinite(px) ? px : null;
}
