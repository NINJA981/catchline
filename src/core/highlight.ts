// Marks the spans of a footnote that produced chips, so the card can wash them in Prussian Wash
// inside the raw text (DESIGN.md "Catch card"). Pure.

export interface TextSegment {
  text: string;
  mark: boolean;
}

type Span = readonly [number, number];

/** Splits `text` at the (possibly overlapping, unsorted) spans. Out-of-range spans are clipped. */
export function segmentText(text: string, spans: readonly Span[]): TextSegment[] {
  const clipped = spans
    .map(([s, e]) => [Math.max(0, s), Math.min(text.length, e)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of clipped) {
    const prev = merged[merged.length - 1];
    if (prev && s <= prev[1]) prev[1] = Math.max(prev[1], e);
    else merged.push([s, e]);
  }
  const out: TextSegment[] = [];
  let at = 0;
  for (const [s, e] of merged) {
    if (s > at) out.push({ text: text.slice(at, s), mark: false });
    out.push({ text: text.slice(s, e), mark: true });
    at = e;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: false });
  return out.length ? out : [{ text, mark: false }];
}

/** Re-bases chip spans from block coordinates to a slice that starts at `offset`. */
export function rebaseSpans(spans: readonly Span[], offset: number): [number, number][] {
  return spans.map(([s, e]) => [s - offset, e - offset]);
}
