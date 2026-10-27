// Tab rollup, badge text and tooltip (SPEC §4.2, F7). Pure.

import { formatMoney } from './extract/money';
import type { Catch, TabRollup } from './types';

export const BADGE_MAX_CHARS = 4;

export function buildRollup(tabId: number, catches: readonly Catch[], now: number): TabRollup {
  const counted = catches.filter((c) => c.counted);
  let currency: string | null = null;
  let total = 0;
  const items: string[] = [];
  const seenMoney = new Set<string>();
  let longest: TabRollup['longestTerm'] = null;
  const requirements: string[] = [];
  const seenReq = new Set<string>();
  const rates: string[] = [];
  const seenRate = new Set<string>();

  for (const c of counted) {
    for (const chip of c.chips) {
      if (chip.kind === 'money') {
        // One footnote can serve many claims; count each distinct term once.
        const key = chip.label.toLowerCase();
        if (seenMoney.has(key)) continue;
        seenMoney.add(key);
        items.push(chip.label);
        // Sum one-time amounts in the page's first currency; recurring amounts ("/mo") are listed only.
        const unit = chip.unit ?? '';
        if (chip.value !== undefined && /^[A-Z]{3}$/.test(unit)) {
          currency ??= unit;
          if (unit === currency) total += chip.value;
        }
      } else if (chip.kind === 'time' && chip.value !== undefined && chip.unit === 'months') {
        if (!longest || chip.value > longest.months) {
          longest = { months: chip.value, label: monthsLabel(chip.value) };
        }
      } else if (chip.kind === 'rate') {
        const key = chip.label.toLowerCase();
        if (!seenRate.has(key)) {
          seenRate.add(key);
          rates.push(chip.label);
        }
      } else if (chip.kind === 'requirement') {
        const key = chip.label.toLowerCase();
        if (!seenReq.has(key)) {
          seenReq.add(key);
          requirements.push(chip.label);
        }
      }
    }
  }

  return {
    tabId,
    catches: counted.length,
    listed: catches.length,
    money: { total: Math.round(total * 100) / 100, currency: currency ?? 'USD', items },
    longestTerm: longest,
    requirements,
    rates,
    scannedAt: now,
  };
}

function monthsLabel(months: number): string {
  if (months >= 1 && Number.isInteger(months))
    return `${String(months)} ${months === 1 ? 'month' : 'months'}`;
  const days = Math.round(months * 30);
  return `${String(days)} ${days === 1 ? 'day' : 'days'}`;
}

/** Chrome shows at most 4 characters; 0 clears the badge. */
export function badgeText(rollup: Pick<TabRollup, 'catches'> | null): string {
  const n = rollup?.catches ?? 0;
  if (n <= 0) return '';
  const s = String(n);
  return s.length <= BADGE_MAX_CHARS ? s : '999+';
}

/**
 * "7 catches: $35 + 36 months hidden" (SPEC §4.2; no middle dots per DESIGN.md).
 * Without money or time terms: "7 catches". Without catches: "No catches on this page".
 */
export function rollupSummary(rollup: TabRollup | null): string {
  if (!rollup || rollup.catches === 0) return 'No catches on this page';
  const count = `${String(rollup.catches)} ${rollup.catches === 1 ? 'catch' : 'catches'}`;
  const parts: string[] = [];
  if (rollup.money.total > 0) parts.push(formatMoney(rollup.money.total, rollup.money.currency));
  if (rollup.longestTerm) parts.push(rollup.longestTerm.label);
  if (parts.length === 0) return count;
  return `${count}: ${parts.join(' + ')} hidden`;
}

/** Toolbar tooltip: the summary when there are catches (AC-F7.1), else the product name. */
export function badgeTitle(rollup: TabRollup | null): string {
  return rollup && rollup.catches > 0 ? rollupSummary(rollup) : 'Catchline';
}

/** Shape check for a rollup read back from storage or a message (untrusted input). */
export function isTabRollup(v: unknown): v is TabRollup {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  const money = r.money as Record<string, unknown> | null | undefined;
  return (
    typeof r.tabId === 'number' &&
    typeof r.catches === 'number' &&
    typeof r.listed === 'number' &&
    typeof r.scannedAt === 'number' &&
    Array.isArray(r.requirements) &&
    (r.longestTerm === null || typeof r.longestTerm === 'object') &&
    !!money &&
    typeof money === 'object' &&
    typeof money.total === 'number' &&
    typeof money.currency === 'string' &&
    Array.isArray(money.items)
  );
}
