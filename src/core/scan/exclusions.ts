// Exclusion rules for the marker scanner (SPEC F1, AC-F1.2, AC-F1.3).

import { EXCLUDED_SUBTREE_SELECTOR } from './selectors';

export function isExcludedElement(el: Element): boolean {
  return el.matches(EXCLUDED_SUBTREE_SELECTOR);
}

/** Hidden by attribute (no layout needed). Closed <details> content is hidden; its summary is not. */
export function isHiddenByAttribute(el: Element): boolean {
  if (el.hasAttribute('hidden')) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  const parent = el.parentElement;
  if (parent?.tagName === 'DETAILS' && !parent.hasAttribute('open') && el.tagName !== 'SUMMARY') {
    return true;
  }
  return false;
}

/**
 * Up to `max` characters of text that come right before `node` inside its block, walking previous
 * siblings and climbing through inline ancestors. Used for cents and attachment rules.
 */
export function textBefore(node: Node, max = 24): string {
  let out = '';
  let cur: Node = node;
  let climbs = 0;
  while (out.length < max && climbs < 4) {
    let sib: Node | null = cur.previousSibling;
    while (sib && out.length < max) {
      out = (sib.textContent ?? '') + out;
      sib = sib.previousSibling;
    }
    if (out.length >= max) break;
    const parent: Element | null = cur.parentElement;
    if (!parent || !isInlineish(parent)) break;
    cur = parent;
    climbs++;
  }
  return out.slice(-max);
}

/** Text right after `node`, same walk as textBefore but forward. */
export function textAfter(node: Node, max = 12): string {
  let out = '';
  let cur: Node = node;
  let climbs = 0;
  while (out.length < max && climbs < 4) {
    let sib: Node | null = cur.nextSibling;
    while (sib && out.length < max) {
      out += sib.textContent ?? '';
      sib = sib.nextSibling;
    }
    if (out.length >= max) break;
    const parent: Element | null = cur.parentElement;
    if (!parent || !isInlineish(parent)) break;
    cur = parent;
    climbs++;
  }
  return out.slice(0, max);
}

const INLINEISH = new Set([
  'A',
  'BUTTON',
  'LABEL',
  'B',
  'EM',
  'I',
  'SPAN',
  'STRONG',
  'SUP',
  'SMALL',
  'U',
  'MARK',
  'FONT',
  'DATA',
  'TIME',
  'ABBR',
  'BIG',
  'S',
  'DEL',
  'INS',
]);
function isInlineish(el: Element): boolean {
  return INLINEISH.has(el.tagName);
}

const CURRENCY_AMOUNT_END = /[$€£¥]\s?\d[\d,]*\.?$/;
const DIGIT_END = /\d[.,]?$/;

/**
 * A <sup> that prints cents or a fractional part of a price:
 * "$49<sup>99</sup>", "$4<sup>.99</sup>", "19<sup>99</sup>".
 * A single digit after a price ("$50<sup>1</sup>") is a footnote, since cents are always two digits.
 */
export function isCentsSuperscript(supText: string, before: string): boolean {
  const t = supText.trim();
  if (/^[.,]\d{1,2}$/.test(t)) return true;
  if (/^\d{2}$/.test(t) && (DIGIT_END.test(before) || CURRENCY_AMOUNT_END.test(before)))
    return true;
  return false;
}

/** Ordinals, trademarks and exponents printed in <sup>. */
export function isNonFootnoteSuperscript(supText: string, before: string): boolean {
  const t = supText.trim();
  if (!t) return true;
  if (/^(st|nd|rd|th|e|er|re|ème|o|a)$/i.test(t) && /\d$/.test(before)) return true; // 1st, 2nd, 1er
  if (/^(™|®|©|℠|tm|sm|\(r\)|\(c\))$/i.test(t)) return true;
  if (/^[-−+]\d/.test(t)) return true; // 10^-3
  if (/^\d+$/.test(t) && /(?:^|[^\p{L}])(?:m|cm|mm|km|ft|in|mi|yd|sq|x|y|n)$/iu.test(before)) {
    return true; // m², x²
  }
  return false;
}

/** Superscript text that can be a footnote reference. Returns the key or null. */
export function footnoteKeyFromSup(supText: string): string | null {
  const t = supText.replace(/\s+/g, '');
  let m = /^\[?(\d{1,3})(?:[,–-]\d{1,3})*\]?$/.exec(t);
  if (m?.[1]) return String(Number(m[1]));
  m = /^\[?([a-z])\]?$/i.exec(t);
  if (m?.[1]) return m[1].toLowerCase();
  m = /^(\*{1,2}|†{1,2}|‡{1,2}|§|¶)$/.exec(t);
  if (m?.[1]) return m[1];
  return null;
}

/** Unicode superscript digits used as units or exponents: "m²", "10³" (unless "$10¹"). */
export function isUnitOrExponentSuperscript(before: string): boolean {
  if (/(?:^|[^\p{L}])(?:m|cm|mm|km|ft|in|mi|yd|sq|mc|x|y|n)$/iu.test(before)) return true;
  if (/\d$/.test(before) && !CURRENCY_AMOUNT_END.test(before)) return true;
  return false;
}
