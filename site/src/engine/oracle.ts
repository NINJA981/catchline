// StyleOracle for pasted pages (adapter, not engine logic).
//
// A page parsed with DOMParser has no layout, so getComputedStyle returns nothing. The core's
// createInlineStyleOracle already reads inline `font-size`; this adapter adds the two other places
// a pasted page keeps its small print: simple rules in its own <style> elements and the HTML
// presentational defaults (<small>, <sup>, <sub>, font-size keywords). Rules inside @media and
// @supports blocks are ignored. Everything here is a lookup of the page's own declarations; the
// "is this small print" decision stays in src/core.

import type { StyleOracle } from '@catchline/core';

interface SizeRule {
  selector: string;
  specificity: number;
  order: number;
  value: string;
}

const KEYWORD_PX: Record<string, number> = {
  'xx-small': 9,
  'x-small': 10,
  small: 13,
  medium: 16,
  large: 18,
  'x-large': 24,
  'xx-large': 32,
};

const MAX_RULES = 1500;

/** Strip comments and at-rule blocks, then collect `selector { font-size: v }` pairs. */
export function parseFontSizeRules(css: string): SizeRule[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: SizeRule[] = [];
  let depth = 0;
  let start = 0;
  let prelude = '';
  let atBlockDepth = -1;
  let order = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') {
      if (depth === 0) {
        prelude = clean.slice(start, i).trim();
        if (prelude.startsWith('@')) atBlockDepth = 0;
        start = i + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const body = clean.slice(start, i);
        if (atBlockDepth !== 0 && prelude) {
          const m = /(?:^|;)\s*font-size\s*:\s*([^;!}]+)/i.exec(body);
          const value = m?.[1]?.trim();
          if (value) {
            for (const sel of prelude.split(',')) {
              const selector = sel.trim();
              if (selector) {
                rules.push({
                  selector,
                  specificity: specificityOf(selector),
                  order: order++,
                  value,
                });
              }
            }
          }
        }
        atBlockDepth = -1;
        start = i + 1;
      } else if (depth < 0) {
        depth = 0;
        start = i + 1;
      }
    }
    if (rules.length >= MAX_RULES) break;
  }
  return rules;
}

function specificityOf(selector: string): number {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
  const tags = (
    selector
      .replace(/[#.][\w-]+|\[[^\]]+\]|::?[\w-]+(\([^)]*\))?/g, ' ')
      .match(/\b[a-z][\w-]*/gi) ?? []
  ).length;
  return ids * 10000 + classes * 100 + tags;
}

export function createPastedPageOracle(doc: Document, rootPx = 16): StyleOracle {
  const sheetText = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.textContent)
    .join('\n');
  const rules = parseFontSizeRules(sheetText);
  const cache = new WeakMap<Element, number>();

  const declared = (el: Element): string | null => {
    const inline = /font-size\s*:\s*([^;]+)/i.exec(el.getAttribute('style') ?? '');
    if (inline?.[1]) return inline[1].trim();
    let best: SizeRule | null = null;
    for (const r of rules) {
      let hit: boolean;
      try {
        hit = el.matches(r.selector);
      } catch {
        hit = false; // a selector this DOM cannot parse
      }
      if (
        hit &&
        (!best ||
          r.specificity > best.specificity ||
          (r.specificity === best.specificity && r.order > best.order))
      ) {
        best = r;
      }
    }
    return best?.value ?? null;
  };

  const resolve = (el: Element | null): number => {
    if (!el) return rootPx;
    const cached = cache.get(el);
    if (cached !== undefined) return cached;
    const parent = resolve(el.parentElement);
    const value = declared(el)?.toLowerCase();
    let px = parent;
    if (value) {
      const kw = KEYWORD_PX[value];
      const m = /^([\d.]+)\s*(px|pt|em|rem|%)$/.exec(value);
      if (kw !== undefined) px = kw;
      else if (value === 'smaller') px = parent * 0.833;
      else if (value === 'larger') px = parent * 1.2;
      else if (m?.[1] && m[2]) {
        const n = Number(m[1]);
        px =
          m[2] === 'px'
            ? n
            : m[2] === 'pt'
              ? (n * 4) / 3
              : m[2] === 'em'
                ? n * parent
                : m[2] === 'rem'
                  ? n * rootPx
                  : (n / 100) * parent;
      }
    } else if (el.tagName === 'SMALL') px = parent * (13 / 16);
    else if (el.tagName === 'SUP' || el.tagName === 'SUB') px = parent * 0.833;
    cache.set(el, px);
    return px;
  };

  return { fontSizePx: (el) => resolve(el) };
}
