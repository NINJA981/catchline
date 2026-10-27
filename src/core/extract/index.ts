// Catch extractor entry (SPEC F4): run every rule, resolve overlaps, dedupe and order the chips.
// The raw footnote text is always shown under the chips; chips only summarize it.

import { CHIP_KINDS, type Chip, type ChipKind, type Family } from '../types';
import type { Rule } from './rule';
import { BANK_RULES } from './rules/bank';
import { CARRIER_RULES } from './rules/carrier';
import { COMMON_RULES } from './rules/common';
import { RETAIL_RULES } from './rules/retail';
import { SAAS_RULES } from './rules/saas';
import { STREAMING_RULES } from './rules/streaming';
import { TRAVEL_RULES } from './rules/travel';

export const RULES: readonly Rule[] = [
  ...COMMON_RULES,
  ...CARRIER_RULES,
  ...BANK_RULES,
  ...RETAIL_RULES,
  ...STREAMING_RULES,
  ...SAAS_RULES,
  ...TRAVEL_RULES,
];

const FAMILY_BONUS = 10;
const KIND_RANK = new Map<ChipKind, number>(CHIP_KINDS.map((k, i) => [k, i]));

interface Hit {
  chip: Chip;
  score: number;
  ruleId: string;
}

export interface ExtractOptions {
  family?: Family | 'unknown';
  /** Added to every span, so spans point into a larger text the input was cut from. */
  offset?: number;
}

/** Chips from a footnote sentence or block. Deterministic: same text, same chips. */
export function extractChips(text: string, options: ExtractOptions = {}): Chip[] {
  const family = options.family ?? 'unknown';
  const offset = options.offset ?? 0;
  const hits: Hit[] = [];
  for (const r of RULES) {
    r.re.lastIndex = 0;
    for (const m of text.matchAll(r.re)) {
      const built = r.build(m);
      if (!built?.label.trim()) continue;
      const lead = m[0].length - m[0].trimStart().length;
      const start = m.index + lead;
      const end = m.index + m[0].trimEnd().length;
      if (end <= start) continue;
      const chip: Chip = { kind: r.kind, label: built.label, span: [start + offset, end + offset] };
      if (built.value !== undefined && Number.isFinite(built.value)) chip.value = built.value;
      if (built.unit) chip.unit = built.unit;
      hits.push({
        chip,
        score: (r.priority ?? 0) + (r.family && r.family === family ? FAMILY_BONUS : 0),
        ruleId: r.id,
      });
    }
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      spanLength(b.chip) - spanLength(a.chip) ||
      a.chip.span[0] - b.chip.span[0],
  );

  const accepted: Chip[] = [];
  const labels = new Set<string>();
  for (const h of hits) {
    const key = `${h.chip.kind}|${h.chip.label.toLowerCase()}`;
    if (labels.has(key)) continue;
    const blocked = accepted.some(
      (a) =>
        overlaps(a, h.chip) &&
        (a.kind === h.chip.kind || (a.kind !== 'time' && h.chip.kind !== 'time')),
    );
    if (blocked) continue;
    accepted.push(h.chip);
    labels.add(key);
  }

  return accepted.sort(
    (a, b) => (KIND_RANK.get(a.kind) ?? 0) - (KIND_RANK.get(b.kind) ?? 0) || a.span[0] - b.span[0],
  );
}

function spanLength(c: Chip): number {
  return c.span[1] - c.span[0];
}

function overlaps(a: Chip, b: Chip): boolean {
  return a.span[0] < b.span[1] && b.span[0] < a.span[1];
}
