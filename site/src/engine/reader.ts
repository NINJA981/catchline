// Flattens a scanned page into reader blocks: the page's own text, in order, with each marker
// as a run the UI can turn into a button. Built from the same Document the engine analysed, so
// every marker, claim and footnote the engine reports can be found again in the reader.

import type { Analysis, StyleOracle } from '@catchline/core';

export interface ReaderRun {
  text: string;
  /** Marker id when this run is a footnote marker. */
  markerId?: string;
}

export interface ReaderBlock {
  index: number;
  kind: 'heading' | 'text' | 'item';
  level: number;
  runs: ReaderRun[];
  /** Font size the page used for this block, when the oracle knows it. */
  fontPx: number | null;
  /** Footnote ids whose text lives in this block. */
  footnoteIds: string[];
  /** Marker ids that sit in this block. */
  markerIds: string[];
}

export interface Reader {
  blocks: ReaderBlock[];
  truncated: boolean;
  /** footnote id -> block index. */
  footnoteBlock: Map<string, number>;
  /** marker id -> block index. */
  markerBlock: Map<string, number>;
}

export const MAX_READER_BLOCKS = 400;

const SKIP = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'HEAD',
  'TITLE',
  'META',
  'LINK',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'PICTURE',
  'IMG',
  'SELECT',
  'OPTION',
  'INPUT',
  'TEXTAREA',
  'MATH',
]);
const INLINE = new Set([
  'A',
  'ABBR',
  'B',
  'BDI',
  'BDO',
  'BUTTON',
  'CITE',
  'CODE',
  'DATA',
  'DEL',
  'DFN',
  'EM',
  'FONT',
  'I',
  'INS',
  'KBD',
  'LABEL',
  'MARK',
  'Q',
  'S',
  'SAMP',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
  'VAR',
  'WBR',
]);

export function buildReader(doc: Document, analysis: Analysis, oracle: StyleOracle): Reader {
  const anchors = new Map<Text, { start: number; end: number; id: string }[]>();
  const elementMarkers = new Map<Element, string>();
  for (const c of analysis.catches) {
    const m = c.marker;
    const node = m.anchor?.node.deref();
    if (m.anchor && node) {
      const list = anchors.get(node) ?? [];
      list.push({ start: m.anchor.start, end: m.anchor.end, id: m.id });
      anchors.set(node, list);
    } else {
      const el = m.markerEl?.deref();
      if (el) elementMarkers.set(el, m.id);
    }
  }

  const blocks: ReaderBlock[] = [];
  const ownerIndex = new Map<Element, number>();
  let truncated = false;

  let owner: Element | null = null;
  let runs: ReaderRun[] = [];

  const flush = (): void => {
    const el = owner;
    const current = runs;
    owner = null;
    runs = [];
    if (!el) return;
    const first = current[0];
    if (first) first.text = first.text.replace(/^\s+/, '');
    const last = current[current.length - 1];
    if (last) last.text = last.text.replace(/\s+$/, '');
    const kept = current.filter((r) => r.text.length > 0);
    if (kept.length === 0) return;
    if (blocks.length >= MAX_READER_BLOCKS) {
      truncated = true;
      return;
    }
    const tag = el.tagName;
    const level = /^H([1-6])$/.exec(tag)?.[1];
    const block: ReaderBlock = {
      index: blocks.length,
      kind: level ? 'heading' : tag === 'LI' ? 'item' : 'text',
      level: level ? Number(level) : 0,
      runs: kept,
      fontPx: oracle.fontSizePx(el),
      footnoteIds: [],
      markerIds: kept.flatMap((r) => (r.markerId ? [r.markerId] : [])),
    };
    ownerIndex.set(el, block.index);
    blocks.push(block);
  };

  const push = (run: ReaderRun, blockEl: Element): void => {
    owner ??= blockEl;
    const prev = runs[runs.length - 1];
    if (prev && !prev.markerId && !run.markerId) prev.text += run.text;
    else runs.push(run);
  };

  const text = (node: Text, blockEl: Element): void => {
    const data = node.data;
    const found = anchors.get(node);
    if (!found) {
      push({ text: data.replace(/\s+/g, ' ') }, blockEl);
      return;
    }
    let at = 0;
    for (const a of [...found].sort((x, y) => x.start - y.start)) {
      if (a.start < at) continue;
      if (a.start > at) push({ text: data.slice(at, a.start).replace(/\s+/g, ' ') }, blockEl);
      push({ text: data.slice(a.start, a.end), markerId: a.id }, blockEl);
      at = a.end;
    }
    if (at < data.length) push({ text: data.slice(at).replace(/\s+/g, ' ') }, blockEl);
  };

  const walk = (parent: Element, blockEl: Element): void => {
    for (const child of Array.from(parent.childNodes)) {
      if (blocks.length >= MAX_READER_BLOCKS) {
        truncated = true;
        return;
      }
      if (child.nodeType === 3) {
        text(child as Text, blockEl);
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      if (SKIP.has(tag)) continue;
      if (tag === 'BR') {
        push({ text: ' ' }, blockEl);
        continue;
      }
      const markerId = elementMarkers.get(el);
      if (markerId) {
        push({ text: el.textContent.trim(), markerId }, blockEl);
        continue;
      }
      if (INLINE.has(tag)) {
        walk(el, blockEl);
      } else {
        flush();
        walk(el, el);
        flush();
      }
    }
  };

  const body = doc.body;
  walk(body, body);
  flush();

  // Link footnotes and markers to blocks by climbing from their elements.
  const blockOf = (el: Element | null | undefined): number | null => {
    for (let cur = el ?? null; cur; cur = cur.parentElement) {
      const i = ownerIndex.get(cur);
      if (i !== undefined) return i;
    }
    return null;
  };
  const footnoteBlock = new Map<string, number>();
  for (const [id, fn] of analysis.footnotes) {
    const i = blockOf(fn.block.el.deref());
    if (i === null) continue;
    footnoteBlock.set(id, i);
    blocks[i]?.footnoteIds.push(id);
  }
  const markerBlock = new Map<string, number>();
  for (const b of blocks) for (const id of b.markerIds) markerBlock.set(id, b.index);
  for (const c of analysis.catches) {
    if (markerBlock.has(c.marker.id)) continue;
    // Markers whose text was not rendered (for example a phrase inside skipped markup).
    const i = blockOf(c.marker.claimEl.deref());
    if (i !== null) markerBlock.set(c.marker.id, i);
  }
  return { blocks, truncated, footnoteBlock, markerBlock };
}
