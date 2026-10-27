// One page scan: markers -> candidates -> matches -> chips -> catches. DOM in, data out.

import { extractChips } from './extract/index';
import { guessFamily } from './family';
import { collectCandidates } from './match/candidates';
import { matchMarkers, type MatchedFootnote } from './match/index';
import { scanMarkers } from './scan/markers';
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
}

// Price, rate or percentage in the claim itself: "$0/mo", "0% intro APR", "50% off".
const CLAIM_TERMS = /[$€£]\s?\d|\d\s?%|\bAPR\b|\bAPY\b/i;

export function analyze(
  doc: Document,
  oracle: StyleOracle,
  options: AnalyzeOptions = {},
): Analysis {
  const root = (options.root ?? doc.body) as Element | null;
  if (!root) return { family: 'unknown', catches: [], footnotes: new Map() };
  const family = options.family ?? guessFamily(root.textContent).family;
  const markers = scanMarkers(root, { family });
  if (markers.length === 0) return { family, catches: [], footnotes: new Map() };
  const index = collectCandidates(root, oracle);
  const { matches, footnotes } = matchMarkers(markers, index);

  const catches: Catch[] = [];
  for (const marker of markers) {
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
