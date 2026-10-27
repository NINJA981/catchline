// Confidence model for Stage B matches (ADR §4.3). Thresholds are starting values, tuned only
// against the corpus.

export const MATCH_THRESHOLD = 0.45;
export const MATCHED_THRESHOLD = 0.8;

export interface CandidateFeatures {
  /** Block starts with the same glyph or number as the marker. */
  sameKey: boolean;
  /** Markerless phrase matched to a whole legal section. */
  phraseSection: boolean;
  inLegal: boolean;
  smallFont: boolean;
  hidden: boolean;
  belowClaim: boolean;
  nearestFollowing: boolean;
  /** Number of candidates sharing the key. */
  candidates: number;
  /** Token overlap between claim and footnote, 0..1. */
  overlap: number;
}

export interface Scored {
  confidence: number;
  signals: string[];
}

const W = {
  sameKey: 0.45,
  phrase: 0.25,
  legal: 0.2,
  smallFontAlone: 0.15,
  smallFontWithLegal: 0.05,
  below: 0.1,
  nearest: 0.1,
  unique: 0.1,
  perExtraCandidate: -0.05,
  maxCrowdPenalty: -0.2,
  overlap: 0.2,
} as const;

export function scoreCandidate(f: CandidateFeatures): Scored {
  const signals: string[] = [];
  let s = 0;
  if (f.sameKey) {
    s += W.sameKey;
    signals.push('same-glyph-block-start');
  }
  if (f.phraseSection) {
    s += W.phrase;
    signals.push('phrase-legal-section');
  }
  if (f.inLegal) {
    s += W.legal;
    signals.push('legal-container');
  }
  if (f.smallFont) {
    s += f.inLegal ? W.smallFontWithLegal : W.smallFontAlone;
    signals.push('small-font');
  }
  if (f.hidden) signals.push('hidden-text');
  if (f.belowClaim) {
    s += W.below;
    signals.push('below-claim');
  }
  if (f.nearestFollowing) {
    s += W.nearest;
    signals.push('nearest-following');
  }
  if (f.candidates <= 1) {
    s += W.unique;
    signals.push('unique-candidate');
  } else {
    s += Math.max(W.maxCrowdPenalty, W.perExtraCandidate * (f.candidates - 1));
    signals.push(`candidates:${String(f.candidates)}`);
  }
  if (f.overlap > 0) {
    s += W.overlap * f.overlap;
    signals.push(`token-overlap:${f.overlap.toFixed(2)}`);
  }
  // 1.0 is reserved for explicit links (Stage A).
  const confidence = Math.round(Math.min(0.99, Math.max(0, s)) * 100) / 100;
  return { confidence, signals };
}

export type ConfidenceLevel = 'matched' | 'likely' | 'not-found';

export function confidenceLevel(confidence: number, hasFootnote: boolean): ConfidenceLevel {
  if (!hasFootnote || confidence < MATCH_THRESHOLD) return 'not-found';
  return confidence >= MATCHED_THRESHOLD ? 'matched' : 'likely';
}
