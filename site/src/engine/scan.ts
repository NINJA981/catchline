// One scan: pasted text or page HTML in, engine results plus a reader view out.
// All logic comes from the shared engine module; this file only wires it to the browser.

import {
  analyze,
  buildRollup,
  guessFamily,
  rollupSummary,
  type Analysis,
  type Catch,
  type TabRollup,
} from '@catchline/core';
import { createPastedPageOracle } from './oracle';
import { parseInput, type ParsedInput } from './parse';
import { buildReader, type Reader } from './reader';

export interface ScanResult {
  parsed: ParsedInput;
  analysis: Analysis;
  rollup: TabRollup;
  /** "3 catches: $35 + 36 months hidden" (engine copy). */
  summary: string;
  title: string | null;
  reader: Reader;
  /** Counted catches in page order, then the rest. */
  ordered: Catch[];
  byMarker: Map<string, Catch>;
  scannedAt: Date;
}

export function scanInput(raw: string, now: Date = new Date()): ScanResult {
  const parsed = parseInput(raw);
  const oracle = createPastedPageOracle(parsed.doc);
  const family = guessFamily(parsed.doc.body.textContent).family;
  const analysis = analyze(parsed.doc, oracle, { family });
  const rollup = buildRollup(0, analysis.catches, now.getTime());
  const reader = buildReader(parsed.doc, analysis, oracle);
  const byMarker = new Map(analysis.catches.map((c) => [c.marker.id, c]));
  const ordered = [
    ...analysis.catches.filter((c) => c.counted),
    ...analysis.catches.filter((c) => !c.counted),
  ];
  const heading = parsed.doc.querySelector('h1')?.textContent.trim();
  const title = parsed.doc.title.trim() || heading || null;
  return {
    parsed,
    analysis,
    rollup,
    summary: rollupSummary(rollup),
    title,
    reader,
    ordered,
    byMarker,
    scannedAt: now,
  };
}
