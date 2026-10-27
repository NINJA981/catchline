// Splits a chip or ledger label into words and figures so the UI can set every comparable number in
// Commit Mono (DESIGN.md "The Figures Are Mono Rule"). Pure.

export interface FigureSegment {
  text: string;
  figure: boolean;
}

// A figure: optional currency, digits with thousands commas and decimals, optional percent, an
// optional range ("19.24%-29.99%", "$5-$10") and an optional unit slash ("/mo").
const FIGURE_RE =
  /[$€£]?\d[\d,]*(?:\.\d+)?%?(?:\s?[-–]\s?[$€£]?\d[\d,]*(?:\.\d+)?%?)?(?:\/[a-z]+)?/gi;

export function splitFigures(label: string): FigureSegment[] {
  const out: FigureSegment[] = [];
  let last = 0;
  for (const m of label.matchAll(FIGURE_RE)) {
    const start = m.index;
    if (start > last) out.push({ text: label.slice(last, start), figure: false });
    out.push({ text: m[0], figure: true });
    last = start + m[0].length;
  }
  if (last < label.length) out.push({ text: label.slice(last), figure: false });
  return out;
}
