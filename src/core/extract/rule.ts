// Extractor rule shape. Rules are deterministic regexes with a label builder (SPEC F4).

import type { ChipKind, Family } from '../types';

export interface Built {
  label: string;
  value?: number;
  unit?: string;
}

export interface Rule {
  id: string;
  kind: ChipKind;
  /** Must carry the `g` flag. */
  re: RegExp;
  build: (m: RegExpExecArray) => Built | null;
  /** Rules tagged with a family win overlaps on that family's pages. */
  family?: Family;
  /** Higher wins overlaps; default 0. */
  priority?: number;
}

export function rule(r: Rule): Rule {
  if (!r.re.flags.includes('g')) throw new Error(`Rule ${r.id} needs the g flag`);
  return r;
}

/** Sentence-case a phrase: first letter up, the rest untouched. */
export function sentenceCase(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Months from an amount and a unit word. */
export function toMonths(n: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('y')) return n * 12;
  if (u.startsWith('w')) return Math.round(((n * 7) / 30) * 100) / 100;
  if (u.startsWith('d')) return Math.round((n / 30) * 100) / 100;
  if (u.startsWith('billing')) return n;
  return n;
}

/** "mo" -> "month", "yrs" -> "year". */
export function unitWord(unit: string): string {
  const u = unit.toLowerCase();
  if (u.startsWith('y')) return 'year';
  if (u.startsWith('w')) return 'week';
  if (u.startsWith('d')) return 'day';
  if (u.startsWith('billing')) return 'billing cycle';
  return 'month';
}

export function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? '' : 's'}`;
}

export const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
};

export function parseCount(s: string): number {
  const n = NUMBER_WORDS[s.toLowerCase()];
  return n ?? Number(s.replace(/,/g, ''));
}
