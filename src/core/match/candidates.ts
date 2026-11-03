// Stage B candidate collection (SPEC F2, ADR §4.3).
// Every block element contributes its own "lines": text and inline children, with <br> and block
// children acting as line breaks. A line that starts with a footnote key becomes a candidate.

import { domPath, shortId } from '../hash';
import { footnoteKeyFromSup, isExcludedElement } from '../scan/exclusions';
import { leadingKey } from '../scan/glyphs';
import {
  LEGAL_CONTAINER_SELECTOR,
  NOTE_LIST_SELECTOR,
  REFERENCE_LIST_SELECTOR,
} from '../scan/selectors';
import { collapseWhitespace, wordCount } from '../text';
import { drain, type Steps } from '../steps';
import type { FootnoteBlock, StyleOracle } from '../types';

export interface Candidate {
  block: FootnoteBlock;
  /** Footnote key ('*', '†', '3', 'a') or 'phrase' for whole legal sections. */
  key: string;
  inLegal: boolean;
  smallFont: boolean;
  inDetails: boolean;
  hidden: boolean;
  inReferenceList: boolean;
  /** 'strong': Wikipedia-style reference list; 'weak': generic note list; null: neither. */
  referenceKind: ReferenceKind;
  /** Text after the lead, used for extraction and overlap. */
  body: string;
  /** Offset of `body` within block.text. */
  bodyOffset: number;
}

export type ReferenceKind = 'strong' | 'weak' | null;

export interface CandidateIndex {
  candidates: Candidate[];
  /** Outermost legal sections, keyed 'phrase', for markerless "Terms apply" claims. */
  sections: Candidate[];
  byKey: Map<string, Candidate[]>;
  byId: Map<string, Candidate>;
}

const BLOCKISH = new Set([
  'P',
  'LI',
  'DIV',
  'DD',
  'DT',
  'TD',
  'TH',
  'SECTION',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'FIGCAPTION',
  'SUMMARY',
  'DETAILS',
  'FOOTER',
  'MAIN',
  'HEADER',
  'NAV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'DL',
  'TABLE',
  'TBODY',
  'THEAD',
  'TR',
  'BODY',
  'FORM',
  'FIELDSET',
  'ADDRESS',
  'HR',
]);

const BLOCK_SELECTOR = [...BLOCKISH].map((t) => t.toLowerCase()).join(',');
const SYMBOL_LEAD = /^[*†‡§¶⁰¹²³⁴⁵⁶⁷⁸⁹]/;
// Split a line where a new footnote starts mid-line: "…agreement. †Unlimited…" or "…fee. 2 Price…".
const MIDLINE_SPLIT = /(?<=[.!?)])\s+(?=[*†‡§¶⁰¹²³⁴⁵⁶⁷⁸⁹])/g;

interface Line {
  text: string;
  supKey: string | null;
}

export function collectCandidates(
  root: Element,
  oracle: StyleOracle,
  scopes?: readonly Element[] | null,
): CandidateIndex {
  return drain(collectCandidatesSteps(root, oracle, scopes));
}

/** The same collection as a generator that yields between elements (see steps.ts). */
export function* collectCandidatesSteps(
  root: Element,
  oracle: StyleOracle,
  scopes?: readonly Element[] | null,
): Steps<CandidateIndex> {
  const doc = root.ownerDocument;
  const bodyPx = oracle.fontSizePx(doc.body) ?? 16;
  const candidates: Candidate[] = [];
  const els = (scopes ?? [root]).flatMap((s) => [
    s,
    ...Array.from(s.querySelectorAll(BLOCK_SELECTOR)),
  ]);
  const seenText = new Set<string>();

  let visited = 0;
  for (const el of els) {
    if (++visited % 16 === 0) yield;
    if (isExcludedElement(el) || el.closest('[data-catchline]')) continue;
    const ctx = contextOf(el, oracle, bodyPx);
    const lines = ownLines(el);
    let olIndex: number | null = null;
    if (el.tagName === 'LI' && el.parentElement?.tagName === 'OL') {
      const ol = el.parentElement;
      const start = Number(ol.getAttribute('start') ?? '1') || 1;
      olIndex = start + Array.from(ol.children).indexOf(el);
    }
    let first = true;
    for (const line of lines) {
      for (const segment of splitMidline(line)) {
        const text = collapseWhitespace(segment.text);
        if (!text) continue;
        const lead = segment.supKey ? { key: segment.supKey, length: 0 } : leadingKey(text);
        let key = lead?.key ?? null;
        let leadLen = lead?.length ?? 0;
        const zone =
          ctx.inLegal || ctx.smallFont || ctx.inDetails || ctx.hidden || ctx.inReferenceList;
        if (key && !segment.supKey && !SYMBOL_LEAD.test(text) && !zone) key = null; // "2 lines for $50"
        if (!key && first && olIndex !== null && (ctx.inLegal || ctx.inReferenceList)) {
          key = String(olIndex);
          leadLen = 0;
        }
        first = false;
        if (!key) continue;
        const body = text.slice(leadLen).trim();
        if (!body || body.length < 3) continue;
        const dedupe = `${key}|${text}`;
        if (seenText.has(dedupe)) continue; // responsive duplicates
        seenText.add(dedupe);
        const id = shortId('f', `${domPath(el)}|${key}|${String(candidates.length)}`);
        candidates.push({
          block: {
            id,
            text,
            source: ctx.inDetails
              ? 'details'
              : ctx.hidden
                ? 'hidden'
                : ctx.inLegal
                  ? 'legal-container'
                  : ctx.smallFont
                    ? 'small-font'
                    : 'block-start',
            el: new WeakRef(el),
            wordCount: wordCount(body),
          },
          key,
          ...ctx,
          body,
          bodyOffset: text.indexOf(body),
        });
      }
    }
  }

  const sections = collectSections(root, oracle, bodyPx);
  const byKey = new Map<string, Candidate[]>();
  const byId = new Map<string, Candidate>();
  for (const c of [...candidates, ...sections]) {
    byId.set(c.block.id, c);
    const list = byKey.get(c.key);
    if (list) list.push(c);
    else byKey.set(c.key, [c]);
  }
  return { candidates, sections, byKey, byId };
}

interface Context {
  inLegal: boolean;
  smallFont: boolean;
  inDetails: boolean;
  hidden: boolean;
  inReferenceList: boolean;
  referenceKind: ReferenceKind;
}

export function referenceKindOf(el: Element): ReferenceKind {
  if (el.closest(REFERENCE_LIST_SELECTOR)) return 'strong';
  if (el.closest(NOTE_LIST_SELECTOR)) return 'weak';
  return null;
}

function contextOf(el: Element, oracle: StyleOracle, bodyPx: number): Context {
  const px = oracle.fontSizePx(el);
  const referenceKind = referenceKindOf(el);
  return {
    inLegal: el.closest(LEGAL_CONTAINER_SELECTOR) !== null,
    smallFont: px !== null && px <= bodyPx * 0.85,
    inDetails: el.closest('details') !== null,
    hidden: el.closest('[hidden],[aria-hidden="true"]') !== null,
    inReferenceList: referenceKind !== null,
    referenceKind,
  };
}

/** The element's own text, split into lines at <br> and block children. */
export function ownLines(el: Element): Line[] {
  const lines: Line[] = [];
  let cur: Line = { text: '', supKey: null };
  const flush = () => {
    if (cur.text.trim()) lines.push(cur);
    cur = { text: '', supKey: null };
  };
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      cur.text += (child as Text).data;
      continue;
    }
    if (child.nodeType !== 1) continue;
    const c = child as Element;
    if (c.tagName === 'BR') {
      flush();
      continue;
    }
    if (BLOCKISH.has(c.tagName)) {
      flush();
      continue;
    }
    if (isExcludedElement(c)) continue;
    const text = c.textContent;
    if (!cur.text.trim() && cur.supKey === null) {
      const supKey = leadingSupKey(c);
      if (supKey) {
        cur.supKey = supKey;
        cur.text += text + ' ';
        continue;
      }
    }
    cur.text += text;
  }
  flush();
  return lines;
}

/** `<sup>3</sup>`, `<a><sup>3</sup></a>` or `<sup><a>3</a></sup>` at the start of a line. */
function leadingSupKey(el: Element): string | null {
  const sup = el.tagName === 'SUP' ? el : el.tagName === 'A' ? el.querySelector('sup') : null;
  if (!sup) return null;
  if (el.tagName === 'A' && el.textContent.trim() !== sup.textContent.trim()) {
    return null;
  }
  return footnoteKeyFromSup(sup.textContent);
}

function splitMidline(line: Line): Line[] {
  const parts = line.text.split(MIDLINE_SPLIT);
  if (parts.length === 1) return [line];
  return parts.map((text, i) => ({ text, supKey: i === 0 ? line.supKey : null }));
}

/** Outermost legal sections (and closed "offer details" <details>) as phrase candidates. */
function collectSections(root: Element, oracle: StyleOracle, bodyPx: number): Candidate[] {
  const out: Candidate[] = [];
  const nodes = Array.from(root.querySelectorAll(`${LEGAL_CONTAINER_SELECTOR},details`));
  for (const el of nodes) {
    const parent = el.parentElement;
    if (parent?.closest(`${LEGAL_CONTAINER_SELECTOR},details`)) continue; // keep outermost
    if (isExcludedElement(el)) continue;
    const text = collapseWhitespace(el.textContent);
    if (wordCount(text) < 4) continue;
    const ctx = contextOf(el, oracle, bodyPx);
    out.push({
      block: {
        id: shortId('s', domPath(el)),
        text,
        source: ctx.inDetails ? 'details' : ctx.hidden ? 'hidden' : 'legal-container',
        el: new WeakRef(el),
        wordCount: wordCount(text),
      },
      key: 'phrase',
      ...ctx,
      inLegal: true,
      body: text,
      bodyOffset: 0,
    });
  }
  return out;
}
