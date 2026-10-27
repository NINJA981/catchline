// Many-to-one sentence selection (SPEC F3): pick the footnote sentence that best overlaps a claim.

import { splitSentences, tokenOverlap, tokenize, type SentenceSpan, type Token } from '../text';

export interface SentenceChoice {
  start: number;
  end: number;
  score: number;
  /** Distinct claim tokens found in the chosen sentence. */
  hits: number;
}

export interface SentenceIndex {
  sentences: SentenceSpan[];
  tokens: Token[][];
  idf: Map<string, number>;
}

/** Precompute sentence tokens and idf once per footnote; reuse for every claim that shares it. */
export function indexSentences(text: string, offset = 0): SentenceIndex {
  const sentences = splitSentences(text.slice(offset)).map((s) => ({
    ...s,
    start: s.start + offset,
    end: s.end + offset,
  }));
  const tokens = sentences.map((s) => tokenize(s.text));
  const df = new Map<string, number>();
  for (const toks of tokens) {
    for (const v of new Set(toks.map((t) => t.value))) df.set(v, (df.get(v) ?? 0) + 1);
  }
  const n = Math.max(1, sentences.length);
  const idf = new Map<string, number>();
  for (const [v, d] of df) idf.set(v, Math.log(1 + n / d));
  return { sentences, tokens, idf };
}

/** Best sentence for a claim, or null when nothing overlaps. Ties go to the earlier sentence. */
export function chooseSentence(claimText: string, index: SentenceIndex): SentenceChoice | null {
  const claim = tokenize(claimText).filter((t) => index.idf.has(t.value));
  if (claim.length === 0) return null;
  let best: SentenceChoice | null = null;
  index.sentences.forEach((s, i) => {
    const score = tokenOverlap(claim, index.tokens[i] ?? [], index.idf);
    if (score > 0 && (!best || score > best.score + 1e-9)) {
      const have = new Set((index.tokens[i] ?? []).map((t) => t.value));
      const hits = new Set(claim.filter((t) => have.has(t.value)).map((t) => t.value)).size;
      best = { start: s.start, end: s.end, score, hits };
    }
  });
  return best;
}
