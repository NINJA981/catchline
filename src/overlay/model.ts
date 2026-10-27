// View model for one catch: everything the card, the rail and the share image render, derived from
// the core Analysis once per scan. Live element lookups stay as functions so the overlay always
// reads current geometry.

import {
  cardState,
  expanderLabel,
  glyphDisplay,
  rebaseSpans,
  type Analysis,
  type CardState,
  type Catch,
  type Chip,
  type Marker,
} from '../core';

export interface CatchModel {
  id: string;
  /** Position among all listed catches, page order. */
  index: number;
  glyph: string;
  claimText: string;
  counted: boolean;
  reference: boolean;
  family: Marker['family'];
  card: CardState;
  confidence: number;
  chips: Pick<Chip, 'kind' | 'label' | 'span'>[];
  /** The text the card shows: the chosen sentence, or the whole footnote. */
  shownText: string | null;
  shownSpans: [number, number][];
  /** The whole footnote when only a sentence is shown, else null. */
  fullText: string | null;
  fullSpans: [number, number][];
  expanderLabel: string | null;
  marker: Marker;
  footnoteEl: () => Element | null;
}

export function buildModels(analysis: Analysis): CatchModel[] {
  return analysis.catches.map((c, index) => modelFor(analysis, c, index));
}

function modelFor(analysis: Analysis, c: Catch, index: number): CatchModel {
  const fn = c.match.footnoteId ? analysis.footnotes.get(c.match.footnoteId) : undefined;
  let shownText: string | null = null;
  let shownSpans: [number, number][] = [];
  let fullText: string | null = null;
  let fullSpans: [number, number][] = [];
  let label: string | null = null;
  const spans = c.chips.map((x) => x.span);
  if (fn) {
    const text = fn.block.text;
    const s = c.match.sentence;
    if (s && (s.start > 0 || s.end < text.length)) {
      shownText = text.slice(s.start, s.end);
      shownSpans = rebaseSpans(spans, s.start);
      fullText = text;
      fullSpans = rebaseSpans(spans, 0);
      label = expanderLabel(fn.block.wordCount);
    } else {
      shownText = text;
      shownSpans = rebaseSpans(spans, 0);
    }
  }
  return {
    id: c.marker.id,
    index,
    glyph: glyphDisplay(c.marker.glyph),
    claimText: c.marker.claimText,
    counted: c.counted,
    reference: c.reference,
    family: c.marker.family,
    card: cardState(c),
    confidence: c.match.confidence,
    chips: c.chips.map(({ kind, label: l, span }) => ({ kind, label: l, span })),
    shownText,
    shownSpans,
    fullText,
    fullSpans,
    expanderLabel: label,
    marker: c.marker,
    footnoteEl: () => (fn ? (fn.block.el.deref() ?? null) : null),
  };
}

/** Catches that get a hit target on the page and a place in Show all. */
export function isInteractive(m: CatchModel): boolean {
  return (
    m.counted ||
    (!m.reference &&
      m.card.kind !== 'matched' &&
      m.card.kind !== 'likely' &&
      m.card.kind !== 'many-to-one')
  );
}

/** Catches Show all lists: counted ones only. */
export function showAllModels(models: readonly CatchModel[]): CatchModel[] {
  return models.filter((m) => m.counted);
}
