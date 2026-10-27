// Catch -> list row for the popup (and the web app's result list). Pure.

import type { Catch } from './types';

/** One row of a catch list. Carries claim text and term labels only; never page URLs. */
export interface CatchSummary {
  id: string;
  claimText: string;
  chipLabels: string[];
  confidence: number;
  counted: boolean;
  reference: boolean;
  matched: boolean;
}

export const SUMMARY_CHIP_LABELS = 3;

export function toCatchSummary(c: Catch): CatchSummary {
  return {
    id: c.marker.id,
    claimText: c.marker.claimText,
    chipLabels: c.chips.slice(0, SUMMARY_CHIP_LABELS).map((chip) => chip.label),
    confidence: c.match.confidence,
    counted: c.counted,
    reference: c.reference,
    matched: c.match.footnoteId !== null,
  };
}

/** Counted catches first in page order, then the rest ("Other footnotes"). */
export function orderSummaries(list: readonly CatchSummary[]): CatchSummary[] {
  return [...list.filter((c) => c.counted), ...list.filter((c) => !c.counted)];
}
