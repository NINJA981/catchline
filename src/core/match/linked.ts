// Stage A: footnotes the page links explicitly (SPEC F2, AC-F2.1).

import { claimBlockFor } from '../scan/claim';
import { collapseWhitespace } from '../text';

export interface LinkedTarget {
  el: Element;
  signal: 'href' | 'aria-describedby' | 'aria-details';
}

const EXTERNAL_TERMS_PATH =
  /(terms|legal|disclosure|disclaimer|offer-details|offer_details|conditions|fine-print|restrictions|rates-and-fees|pricing-terms)/i;

/** Find the element a marker links to with href="#id", aria-describedby or aria-details. */
export function resolveLinked(markerEl: Element, claimEl: Element): LinkedTarget | null {
  const doc = markerEl.ownerDocument;
  // A glyph in text reports its parent element as markerEl, so only look *inside* the marker
  // element when it is the superscript (or link) itself; otherwise a sibling "Details" link in the
  // same block would be mistaken for the marker's own link.
  const ownsLink = markerEl.tagName === 'SUP' || markerEl.tagName === 'A';
  const anchor =
    markerEl.closest('a[href]') ?? (ownsLink ? markerEl.querySelector('a[href]') : null);
  const href = anchor?.getAttribute('href') ?? '';
  if (href.startsWith('#') && href.length > 1) {
    const target = byId(doc, href.slice(1));
    const el = target ? footnoteElementFor(target, markerEl) : null;
    if (el) return { el, signal: 'href' };
  }
  for (const attr of ['aria-describedby', 'aria-details'] as const) {
    let node: Element | null = markerEl;
    while (node) {
      const ids = node.getAttribute(attr);
      if (ids) {
        for (const id of ids.split(/\s+/)) {
          const target = byId(doc, id);
          const el = target ? footnoteElementFor(target, markerEl) : null;
          if (el) return { el, signal: attr };
        }
      }
      if (node === claimEl) break;
      node = node.parentElement;
    }
  }
  return null;
}

function byId(doc: Document, raw: string): Element | null {
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // keep raw
  }
  return doc.getElementById(id);
}

/**
 * The block that holds the footnote text. An empty anchor (`<a id="fn1"></a>`) or a short inline
 * target resolves to its enclosing block. A target that contains the marker is a back-reference.
 */
function footnoteElementFor(target: Element, markerEl: Element): Element | null {
  if (target.contains(markerEl)) return null;
  const text = collapseWhitespace(target.textContent);
  const el = text.length < 4 ? claimBlockFor(target.parentElement ?? target) : target;
  if (!el || el.contains(markerEl)) return null;
  if (collapseWhitespace(el.textContent).length < 2) return null;
  return el;
}

/**
 * "Terms are on another page": a link from the marker, or within the claim block, whose path looks
 * like a terms or legal page.
 */
export function findExternalTerms(
  markerEl: Element | null,
  claimEl: Element,
): { href: string; host: string } | null {
  const links: Element[] = [];
  const own = markerEl?.closest('a[href]');
  if (own) links.push(own);
  links.push(...Array.from(claimEl.querySelectorAll('a[href]')));
  const parentLink = claimEl.closest('a[href]');
  if (parentLink) links.push(parentLink);
  for (const a of links) {
    const raw = a.getAttribute('href') ?? '';
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel):/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, a.ownerDocument.baseURI);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    const linkText = a.textContent;
    if (
      EXTERNAL_TERMS_PATH.test(url.pathname) ||
      /\b(terms|details|conditions)\b/i.test(linkText)
    ) {
      return { href: url.href, host: url.host };
    }
  }
  return null;
}
