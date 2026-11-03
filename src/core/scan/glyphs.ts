// Marker vocabulary (SPEC F1): symbol glyphs, Unicode superscripts and escape-hatch phrases.

import type { SymbolGlyph } from '../types';

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

export const SUPERSCRIPT_CLASS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** "¹²" -> "12" */
export function superscriptToDigits(s: string): string {
  let out = '';
  for (const ch of s) out += SUPERSCRIPT_DIGITS[ch] ?? '';
  return out;
}

/** Normalize a run of symbols to a glyph we track; null when it is not a footnote marker run. */
export function normalizeSymbolRun(run: string): SymbolGlyph | null {
  switch (run) {
    case '*':
    case '**':
    case '†':
    case '††':
    case '‡':
    case '‡‡':
    case '§':
    case '¶':
      return run;
    default:
      return null;
  }
}

/**
 * Markerless escape hatches (SPEC section 4.1). Scanned on every page family.
 * Ordered longest first so "Some exclusions apply" wins over "exclusions apply".
 */
export const ESCAPE_PHRASES = [
  'terms and conditions apply',
  'some exclusions apply',
  'see offer details',
  'restrictions apply',
  'conditions apply',
  'exclusions apply',
  'see details',
  'terms apply',
] as const;

export const ESCAPE_PHRASE_RE = new RegExp(
  `\\b(${ESCAPE_PHRASES.map((p) => p.replace(/ /g, '\\s+')).join('|')})\\b`,
  'i',
);

/**
 * A footnote block's leading key: the glyph or number it starts with.
 * Returns the key ('*', '†', '3', 'a') and the length of the lead including trailing space.
 */
export function leadingKey(text: string): { key: string; length: number } | null {
  const t = text;
  let m = /^\s*(\*{1,3}|†{1,3}|‡{1,2}|§{1,2}|¶{1,2})\s*/.exec(t);
  if (m?.[1]) {
    const glyph = normalizeSymbolRun(m[1]);
    // "***" is treated as its own key; it never matches a 1-2 star marker.
    return { key: glyph ?? m[1], length: m[0].length };
  }
  m = new RegExp(`^\\s*([${SUPERSCRIPT_CLASS}]{1,3})\\s*`).exec(t);
  if (m?.[1]) return { key: superscriptToDigits(m[1]), length: m[0].length };
  // "[3]", "(3)", "3.", "3)" and a bare "3 " followed by a capital letter.
  m = /^\s*(?:\[(\d{1,3})\]|\((\d{1,3})\)|(\d{1,3})[.):]|(\d{1,3})(?=\s+[A-Z]))\s*/.exec(t);
  if (m) {
    const key = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (key) return { key: String(Number(key)), length: m[0].length };
  }
  return null;
}
