// Two-stage matcher (SPEC F2) with many-to-one sentence selection (F3).

import { domPath, shortId } from '../hash';
import { ESCAPE_PHRASE_RE, leadingKey } from '../scan/glyphs';
import { collapseWhitespace, tokenOverlap, tokenize, wordCount } from '../text';
import type { FootnoteBlock, Marker, Match } from '../types';
import {
  referenceKindOf,
  type Candidate,
  type CandidateIndex,
  type ReferenceKind,
} from './candidates';
import { findExternalTerms, resolveLinked } from './linked';
import { MATCH_THRESHOLD, scoreCandidate } from './score';
import { chooseSentence, indexSentences, type SentenceIndex } from './sentence';

/** A footnote that has been matched, with the part of its text that follows the lead. */
export interface MatchedFootnote {
  block: FootnoteBlock;
  body: string;
  bodyOffset: number;
  /** See ReferenceKind: strong lists are never counted; weak ones only when they carry terms. */
  reference: ReferenceKind;
}

export interface MatchResult {
  matches: Map<string, Match>;
  footnotes: Map<string, MatchedFootnote>;
}

/** Phrase matches against a long legal section narrow to one sentence above this many words. */
const PHRASE_SENTENCE_MIN_WORDS = 60;
/**
 * A markerless phrase ("Terms apply") narrows to one sentence of a legal section only when that
 * sentence overlaps the claim at least this much; otherwise the card shows the whole section rather
 * than a guessed sentence.
 */
const PHRASE_SENTENCE_MIN_SCORE = 0.3;
/** ...and shares at least this many distinct words with the claim ("new" alone is not enough). */
const PHRASE_SENTENCE_MIN_HITS = 2;
/** A footnote shared by more than this many claims is many-to-one (ADR §4.4). */
const MANY_TO_ONE_MIN = 2;
/** Node.DOCUMENT_POSITION_FOLLOWING, inlined so the core needs no DOM globals. */
const DOCUMENT_POSITION_FOLLOWING = 4;

export function matchMarkers(markers: readonly Marker[], index: CandidateIndex): MatchResult {
  const matches = new Map<string, Match>();
  const footnotes = new Map<string, MatchedFootnote>();
  const byElement = new Map<Element, Candidate[]>();
  for (const c of index.candidates) {
    const el = c.block.el.deref();
    if (!el) continue;
    const list = byElement.get(el);
    if (list) list.push(c);
    else byElement.set(el, [c]);
  }

  for (const marker of markers) {
    const claimEl = marker.claimEl.deref();
    if (!claimEl) continue;
    const markerEl = marker.markerEl?.deref() ?? null;

    // Stage A: explicit links.
    if (markerEl) {
      const linked = resolveLinked(markerEl, claimEl);
      if (linked) {
        const fn = linkedFootnote(linked.el, marker.key, index.candidates, byElement);
        footnotes.set(fn.block.id, fn);
        matches.set(marker.id, {
          markerId: marker.id,
          footnoteId: fn.block.id,
          sentence: null,
          confidence: 1,
          signals: [linked.signal],
        });
        continue;
      }
    }

    // Stage B: heuristic search for the same key.
    const pool = index.byKey.get(marker.key) ?? [];
    const best = bestCandidate(marker, claimEl, pool);
    if (best && best.confidence >= MATCH_THRESHOLD) {
      const c = best.candidate;
      footnotes.set(c.block.id, {
        block: c.block,
        body: c.body,
        bodyOffset: c.bodyOffset,
        reference: c.referenceKind,
      });
      matches.set(marker.id, {
        markerId: marker.id,
        footnoteId: c.block.id,
        sentence: null,
        confidence: best.confidence,
        signals: best.signals,
      });
      continue;
    }

    // Not found: never a guessed match (AC-F2.4).
    const external = findExternalTerms(markerEl, claimEl);
    const miss: Match = {
      markerId: marker.id,
      footnoteId: null,
      sentence: null,
      confidence: best?.confidence ?? 0,
      signals: best ? ['below-threshold', ...best.signals] : ['no-candidate'],
    };
    if (external) miss.external = external;
    matches.set(marker.id, miss);
  }

  applySentenceSelection(markers, matches, footnotes);
  return { matches, footnotes };
}

interface Best {
  candidate: Candidate;
  confidence: number;
  signals: string[];
}

function bestCandidate(marker: Marker, claimEl: Element, pool: readonly Candidate[]): Best | null {
  const usable = pool.filter((c) => {
    const el = c.block.el.deref();
    return el !== undefined && !el.contains(claimEl) && !claimEl.contains(el);
  });
  if (usable.length === 0) return null;
  const claimTokens = tokenize(marker.claimText);
  let nearestFollowing: Candidate | null = null;
  const below = new Map<Candidate, boolean>();
  for (const c of usable) {
    const el = c.block.el.deref();
    const isBelow =
      el !== undefined && (claimEl.compareDocumentPosition(el) & DOCUMENT_POSITION_FOLLOWING) !== 0;
    below.set(c, isBelow);
    if (isBelow && !nearestFollowing) nearestFollowing = c;
  }
  let best: Best | null = null;
  for (const c of usable) {
    const overlap = tokenOverlap(claimTokens, tokenize(c.body));
    const { confidence, signals } = scoreCandidate({
      sameKey: marker.key !== 'phrase',
      phraseSection: marker.key === 'phrase',
      inLegal: c.inLegal,
      smallFont: c.smallFont,
      hidden: c.hidden || c.inDetails,
      belowClaim: below.get(c) ?? false,
      nearestFollowing: c === nearestFollowing,
      candidates: usable.length,
      overlap,
    });
    if (!best || confidence > best.confidence) best = { candidate: c, confidence, signals };
  }
  return best;
}

/**
 * The footnote a link points at. Links often target a whole legal container ("#offer-details")
 * that holds several footnotes; then the line that starts with the marker's own key wins.
 */
function linkedFootnote(
  el: Element,
  key: string,
  all: readonly Candidate[],
  byElement: Map<Element, Candidate[]>,
): MatchedFootnote {
  const reference = referenceKindOf(el);
  const own = byElement.get(el) ?? [];
  const known =
    own.find((c) => c.key === key) ??
    all.find((c) => c.key === key && el.contains(c.block.el.deref() ?? null)) ??
    (own.length === 1 ? own[0] : undefined);
  if (known) {
    return { block: known.block, body: known.body, bodyOffset: known.bodyOffset, reference };
  }
  // Strip Wikipedia-style back-links ("^", "↑", "a b") from the visible text.
  const text = collapseWhitespace(el.textContent).replace(/^[\^↑↩]\s*(?:[a-z]\s+)*/, '');
  const lead = leadingKey(text);
  const body = lead ? text.slice(lead.length).trim() : text;
  const block: FootnoteBlock = {
    id: shortId('f', `${domPath(el)}|linked`),
    text,
    source: 'linked',
    el: new WeakRef(el),
    wordCount: wordCount(body),
  };
  return { block, body, bodyOffset: Math.max(0, text.indexOf(body)), reference };
}

/** Many-to-one (F3) and long phrase sections: pick the sentence that best fits each claim. */
function applySentenceSelection(
  markers: readonly Marker[],
  matches: Map<string, Match>,
  footnotes: Map<string, MatchedFootnote>,
): void {
  const claimsPerFootnote = new Map<string, Marker[]>();
  for (const marker of markers) {
    const fid = matches.get(marker.id)?.footnoteId;
    if (!fid) continue;
    const list = claimsPerFootnote.get(fid);
    if (list) list.push(marker);
    else claimsPerFootnote.set(fid, [marker]);
  }
  const indexes = new Map<string, SentenceIndex>();
  for (const [fid, claimMarkers] of claimsPerFootnote) {
    const fn = footnotes.get(fid);
    if (!fn) continue;
    const manyToOne = claimMarkers.length > MANY_TO_ONE_MIN;
    for (const marker of claimMarkers) {
      const isLongPhrase =
        marker.key === 'phrase' && fn.block.wordCount > PHRASE_SENTENCE_MIN_WORDS;
      if (!manyToOne && !isLongPhrase) continue;
      let idx = indexes.get(fid);
      if (!idx) {
        idx = indexSentences(fn.block.text, fn.bodyOffset);
        indexes.set(fid, idx);
      }
      if (idx.sentences.length < 2) continue;
      const match = matches.get(marker.id);
      if (!match) continue;
      // The trigger phrase itself ("Terms apply") says nothing about which sentence applies.
      const claim =
        marker.key === 'phrase'
          ? marker.claimText.replace(new RegExp(ESCAPE_PHRASE_RE.source, 'gi'), ' ')
          : marker.claimText;
      const choice = chooseSentence(claim, idx);
      if (manyToOne) match.signals.push(`many-to-one:${String(claimMarkers.length)}`);
      if (!choice) continue;
      if (
        marker.key === 'phrase' &&
        (choice.score < PHRASE_SENTENCE_MIN_SCORE || choice.hits < PHRASE_SENTENCE_MIN_HITS)
      ) {
        continue;
      }
      match.sentence = { start: choice.start, end: choice.end };
    }
  }
}
