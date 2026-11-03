// One page scan: markers -> candidates -> matches -> chips -> catches. DOM in, data out.

import { extractChips } from './extract/index';
import { guessFamily } from './family';
import { collectCandidatesSteps } from './match/candidates';
import { matchMarkersSteps, type MatchedFootnote } from './match/index';
import { scanMarkersSteps, scanScopes } from './scan/markers';
import { drain, runSliced, type SliceOptions, type Steps } from './steps';
import type { Catch, Family, StyleOracle } from './types';

export interface Analysis {
  family: Family | 'unknown';
  catches: Catch[];
  /** Matched footnotes by id: the block plus the body text after its lead. */
  footnotes: Map<string, MatchedFootnote>;
}

export interface AnalyzeOptions {
  /** Force a family instead of guessing from page text. */
  family?: Family | 'unknown';
  /** Scan this subtree instead of the whole body (the welcome page specimen). */
  root?: Element;
  /** Pages over this many text nodes scan only main, footer and legal containers. Default 15,000. */
  maxTextNodes?: number;
}

// Price, rate or percentage in the claim itself: "$0/mo", "0% intro APR", "50% off".
const CLAIM_TERMS = /[$€£]\s?\d|\d\s?%|\bAPR\b|\bAPY\b/i;

export function analyze(
  doc: Document,
  oracle: StyleOracle,
  options: AnalyzeOptions = {},
): Analysis {
  return drain(analyzeSteps(doc, oracle, options));
}

/** `analyze` in time slices: hands the thread back every few milliseconds (ADR 0001 section 3). */
export function analyzeSliced(
  doc: Document,
  oracle: StyleOracle,
  slice: SliceOptions,
  options: AnalyzeOptions = {},
): Promise<Analysis> {
  return runSliced(analyzeSteps(doc, oracle, options), slice);
}

export function* analyzeSteps(
  doc: Document,
  oracle: StyleOracle,
  options: AnalyzeOptions = {},
): Steps<Analysis> {
  const root = (options.root ?? doc.body) as Element | null;
  if (!root) return { family: 'unknown', catches: [], footnotes: new Map() };
  const family = options.family ?? guessFamily(root.textContent).family;
  const scopes = scanScopes(root, options.maxTextNodes);
  yield;
  const markers = yield* scanMarkersSteps(root, { family, ...(scopes ? { scopes } : {}) });
  if (markers.length === 0) return { family, catches: [], footnotes: new Map() };
  yield;
  const index = yield* collectCandidatesSteps(root, oracle, scopes);
  yield;
  const { matches, footnotes } = yield* matchMarkersSteps(markers, index);

  const catches: Catch[] = [];
  for (const marker of markers) {
    yield;
    const match = matches.get(marker.id);
    if (!match) continue;
    const fn = match.footnoteId ? footnotes.get(match.footnoteId) : undefined;
    let chips: Catch['chips'] = [];
    if (fn) {
      const span = match.sentence ?? {
        start: fn.bodyOffset,
        end: fn.bodyOffset + fn.body.length,
      };
      chips = extractChips(fn.block.text.slice(span.start, span.end), {
        family,
        offset: span.start,
      });
    }
    // Wikipedia-style references never count; generic note lists count only when they carry terms.
    const reference =
      fn?.reference === 'strong' || (fn?.reference === 'weak' && chips.length === 0);
    const counted =
      fn !== undefined && !reference && (chips.length > 0 || CLAIM_TERMS.test(marker.claimText));
    catches.push({ marker, match, chips, counted, reference });
  }
  return { family, catches, footnotes };
}
