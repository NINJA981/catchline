// Popup rollup ledger rows (DESIGN.md Popup, "Rollup ledger"): one term per row, no joined strings.

import type { TabRollup } from '../types';

export type LedgerCategory = 'Money' | 'Time' | 'Rates' | 'Requirements';

export interface LedgerRow {
  category: LedgerCategory;
  /** Shown in the label column only on the first row of its category. */
  first: boolean;
  value: string;
}

export const LEDGER_MAX_PER_CATEGORY = 4;

export function ledgerRows(r: TabRollup): LedgerRow[] {
  const groups: [LedgerCategory, string[]][] = [
    ['Money', r.money.items],
    ['Time', r.longestTerm ? [r.longestTerm.label] : []],
    ['Rates', r.rates ?? []],
    ['Requirements', r.requirements],
  ];
  const rows: LedgerRow[] = [];
  for (const [category, values] of groups) {
    values.slice(0, LEDGER_MAX_PER_CATEGORY).forEach((value, i) => {
      rows.push({ category, first: i === 0, value });
    });
  }
  return rows;
}
