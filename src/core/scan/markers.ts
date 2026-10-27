// Marker scanner (SPEC F1). Walks text nodes and <sup> elements once, skipping excluded subtrees.

import { domPath, shortId } from '../hash';
import type { Family, Marker, MarkerGlyph, TextAnchor } from '../types';
import { claimBlockFor, claimTextAt, textOffsetWithin } from './claim';
import {
  footnoteKeyFromSup,
  isCentsSuperscript,
  isExcludedElement,
  isHiddenByAttribute,
  isNonFootnoteSuperscript,
  isUnitOrExponentSuperscript,
  textAfter,
  textBefore,
} from './exclusions';
import {
  ESCAPE_PHRASE_RE,
  SUPERSCRIPT_CLASS,
  normalizeSymbolRun,
  superscriptToDigits,
} from './glyphs';
import { FINE_PRINT_SELECTOR } from './selectors';

export interface ScanMarkersOptions {
  family?: Family | 'unknown';
  /** Pages over this many text nodes scan only main, footer and legal containers (ADR §3). */
  maxTextNodes?: number;
}

interface RawMarker {
  glyph: MarkerGlyph;
  key: string;
  markerEl: Element | null;
  anchorNode: Text | null;
  start: number;
  end: number;
  /** Node used to locate the claim block and the offset of the marker within it. */
  locator: Node;
  locatorOffset: number;
}

const GLYPH_RUN = new RegExp(`(\\*+|†+|‡+|§+|¶+|[${SUPERSCRIPT_CLASS}]+)`, 'g');
const ATTACHED_PREV = /[^\s([{"'“‘]$/u;
// Plain-text emphasis: "*plain text*". The closing star is not a footnote marker.
const EMPHASIS_PAIR = /(?:^|\s)\*[^\s*][^*\n]{0,80}?[^\s*]\*(?=\s|[.,;:!?)]|$)/g;

/** Find every footnote marker in `root` (normally document.body). */
export function scanMarkers(root: Element, options: ScanMarkersOptions = {}): Marker[] {
  const raws: RawMarker[] = [];
  walk(root, raws);

  const family = options.family ?? 'unknown';
  const markers: Marker[] = [];
  const perPath = new Map<string, number>();
  const symbolBlocks = new Set<Element>();

  for (const raw of raws) {
    const block = claimBlockFor(raw.locator);
    if (!block) continue;
    if (raw.glyph === 'phrase' && symbolBlocks.has(block)) continue;
    if (raw.glyph !== 'phrase') symbolBlocks.add(block);
    const offset = textOffsetWithin(block, raw.locator, raw.locatorOffset);
    const claimText = claimTextAt(block, offset);
    const pathEl = raw.markerEl ?? block;
    const pathKey = `${domPath(pathEl)}|${raw.glyph}`;
    const nth = (perPath.get(pathKey) ?? 0) + 1;
    perPath.set(pathKey, nth);
    const anchor: TextAnchor | null = raw.anchorNode
      ? { node: new WeakRef(raw.anchorNode), start: raw.start, end: raw.end }
      : null;
    markers.push({
      id: shortId('m', `${pathKey}|${nth}`),
      glyph: raw.glyph,
      key: raw.key,
      claimText,
      claimEl: new WeakRef(block),
      markerEl: raw.markerEl ? new WeakRef(raw.markerEl) : null,
      anchor,
      family,
      ordinal: markers.length,
    });
  }
  // Drop phrase markers whose block already has a symbol marker (picked up in a later sibling).
  return markers
    .filter((m) => m.glyph !== 'phrase' || !symbolBlocks.has(m.claimEl.deref() as Element))
    .map((m, i) => ({ ...m, ordinal: i }));
}

function walk(root: Element, out: RawMarker[]): void {
  // Iterative DFS in document order; children pushed in reverse.
  const stack: Node[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) break;
    if (node.nodeType === 3) {
      scanText(node as Text, out);
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    if (el !== root && (isExcludedElement(el) || isHiddenByAttribute(el))) continue;
    if (el !== root && el.matches(FINE_PRINT_SELECTOR)) continue;
    if (el.tagName === 'SUP') {
      scanSup(el, out);
      continue;
    }
    if (el.tagName === 'A' && isBareReferenceLink(el)) {
      scanSup(el, out);
      continue;
    }
    const kids = el.childNodes;
    for (let i = kids.length - 1; i >= 0; i--) {
      const kid = kids[i];
      if (kid) stack.push(kid);
    }
  }
}

/** `<a href="#fn2">[2]</a>` outside a <sup>. */
function isBareReferenceLink(a: Element): boolean {
  const href = a.getAttribute('href') ?? '';
  if (!href.startsWith('#') || href.length < 2) return false;
  return /^\s*\[\d{1,3}\]\s*$/.test(a.textContent);
}

function scanSup(sup: Element, out: RawMarker[]): void {
  const text = sup.textContent.trim();
  const before = textBefore(sup);
  if (!text) return;
  if (isCentsSuperscript(text, before) || isNonFootnoteSuperscript(text, before)) return;
  const key = footnoteKeyFromSup(text);
  if (!key) return;
  // A superscript at the very start of its block is a footnote definition, not a claim marker.
  if (!/\S/.test(before) && isAtBlockStart(sup)) return;
  const symbol = normalizeSymbolRun(key);
  const glyph: MarkerGlyph = symbol ?? `sup:${key}`;
  out.push({
    glyph,
    key,
    markerEl: sup,
    anchorNode: null,
    start: 0,
    end: 0,
    locator: sup,
    locatorOffset: 0,
  });
}

function isAtBlockStart(el: Element): boolean {
  const block = claimBlockFor(el);
  if (!block) return true;
  const offset = textOffsetWithin(block, el);
  return !/\S/.test(block.textContent.slice(0, offset));
}

function scanText(node: Text, out: RawMarker[]): void {
  const data = node.data;
  if (!data.trim()) return;
  const emphasis: [number, number][] = [];
  for (const e of data.matchAll(EMPHASIS_PAIR)) {
    emphasis.push([e.index, e.index + e[0].length]);
  }
  GLYPH_RUN.lastIndex = 0;
  let m: RegExpExecArray | null;
  const found: RawMarker[] = [];
  while ((m = GLYPH_RUN.exec(data))) {
    const run = m[0];
    const start = m.index;
    const end = start + run.length;
    if (emphasis.some(([a, b]) => start >= a && end <= b)) continue;
    const prev = start > 0 ? data.slice(Math.max(0, start - 24), start) : textBefore(node);
    const next = end < data.length ? data.slice(end, end + 12) : textAfter(node);
    const raw = classifyRun(run, prev, next);
    if (!raw) continue;
    found.push({
      glyph: raw.glyph,
      key: raw.key,
      markerEl: node.parentElement,
      anchorNode: node,
      start,
      end,
      locator: node,
      locatorOffset: start,
    });
  }
  const phrase = ESCAPE_PHRASE_RE.exec(data);
  if (phrase) {
    found.push({
      glyph: 'phrase',
      key: 'phrase',
      markerEl: null,
      anchorNode: node,
      start: phrase.index,
      end: phrase.index + phrase[0].length,
      locator: node,
      locatorOffset: phrase.index,
    });
  }
  found.sort((a, b) => a.start - b.start);
  out.push(...found);
}

/** Decide whether a glyph run in text is a footnote marker. Exported for table tests. */
export function classifyRun(
  run: string,
  prev: string,
  next: string,
): { glyph: MarkerGlyph; key: string } | null {
  // Must be attached to the claim: "$0/mo*", "Unlimited¹". A glyph after a space is a bullet or a
  // footnote definition.
  if (!ATTACHED_PREV.test(prev)) return null;
  const first = run.charAt(0);
  if (SUPERSCRIPT_CLASS.includes(first)) {
    if (run.length > 3 || isUnitOrExponentSuperscript(prev)) return null;
    const digits = superscriptToDigits(run);
    return { glyph: `uni:${digits}`, key: String(Number(digits)) };
  }
  const glyph = normalizeSymbolRun(run);
  if (!glyph) return null; // "***", "*****" ratings and separators
  if (first === '*') {
    // Multiplication ("2*3"), emphasis ("*word*") and wildcards ("*.pdf") are not markers.
    // "mo*." at a sentence end is a marker; "*.pdf" is a wildcard.
    if (/^(?:[\p{L}\p{N}_]|\.[\p{L}\p{N}])/u.test(next)) return null;
    if (/\d\s*$/.test(prev) && /^\s*\d/.test(next)) return null;
  }
  if ((first === '§' || first === '¶') && /^\s?\d/.test(next)) return null; // "§ 1026.6"
  return { glyph, key: glyph };
}
