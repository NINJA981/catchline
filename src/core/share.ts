// Share card layout (DESIGN.md "Share card (PNG, 1200 x 630)", SPEC F8). Pure: text measurement is
// injected, so the layout is testable without a canvas and the canvas code only paints.

export const SHARE = {
  width: 1200,
  height: 630,
  margin: 64,
  cardWidth: 504, // 336 at 1.5x
  cardPad: 24,
  gutter: 56,
  claimFontPx: 64,
  claimLineHeight: 68,
  textFontPx: 19.5, // 13px at 1.5x
  textLineHeight: 30,
  chipHeight: 36,
  chipGap: 9,
  maxClaimLines: 4,
  maxFineLines: 7,
} as const;

/** 'mixed' sets words in the sans face and every figure in the mono face (chips, ledger labels). */
export type Face = 'sans' | 'mono' | 'mixed';
/** Width in px of `text` set at `px` with the given weight and face. */
export type Measure = (text: string, px: number, weight: number, face: Face) => number;

export interface ShareChipInput {
  kind: string;
  label: string;
}

export interface ShareInput {
  claim: string;
  chips: readonly ShareChipInput[];
  fine: string;
  host: string;
  date: Date;
}

export interface Line {
  text: string;
  x: number;
  /** Baseline y. */
  y: number;
}

export interface ChipBox {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ShareLayout {
  claimPx: number;
  claimLines: Line[];
  card: { x: number; y: number; w: number; h: number };
  chips: ChipBox[];
  fineLines: Line[];
  /** Tether from the claim block to the card edge. */
  tether: { from: { x: number; y: number }; to: { x: number; y: number } };
  footer: { host: string; date: string; y: number };
  moreChips: number;
}

/** Greedy word wrap. The last line ends with an ellipsis when text is cut. */
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; cut: boolean } {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i] ?? '';
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxWidth || !cur) {
      cur = next;
      continue;
    }
    lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  const cut = lines.length === maxLines && (i < words.length || cur !== '');
  if (!cut && cur) lines.push(cur);
  if (cut) {
    let last = lines[maxLines - 1] ?? '';
    const rest = [cur, ...words.slice(i + 1)].join(' ').trim();
    last = rest ? `${last} ${rest}` : last;
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[maxLines - 1] = `${last}…`;
  }
  return { lines, cut };
}

export function formatShareDate(d: Date): string {
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function layoutShare(measure: Measure, input: ShareInput): ShareLayout {
  const S = SHARE;
  const leftW = S.width - 2 * S.margin - S.cardWidth - S.gutter;
  // Claim: shrink until it fits in at most maxClaimLines.
  let claimPx: number = S.claimFontPx;
  let claimLines: string[] = [];
  for (const px of [64, 56, 48, 40, 34]) {
    claimPx = px;
    const r = wrapLines((s) => measure(s, px, 600, 'sans'), input.claim, leftW, S.maxClaimLines);
    claimLines = r.lines;
    if (!r.cut) break;
  }
  const claimLH = Math.round(claimPx * 1.06);

  // Card contents.
  const inner = S.cardWidth - 2 * S.cardPad;
  const chips: ChipBox[] = [];
  let cx = 0;
  let cy = 0;
  const chipFont = 17.5; // 13px label at 1.35x, mono figures are measured with the same box
  let shown = 0;
  for (const c of input.chips.slice(0, 6)) {
    const w = Math.ceil(measure(c.label, chipFont, 500, 'mixed')) + 24;
    if (cx > 0 && cx + w > inner) {
      cx = 0;
      cy += S.chipHeight + S.chipGap;
    }
    chips.push({ label: c.label, x: cx, y: cy, w: Math.min(w, inner), h: S.chipHeight });
    cx += w + S.chipGap;
    shown++;
  }
  const chipsH = chips.length ? cy + S.chipHeight : 0;
  const fine = wrapLines(
    (s) => measure(s, S.textFontPx, 400, 'sans'),
    input.fine,
    inner - 24,
    S.maxFineLines,
  );
  const fineH = fine.lines.length ? fine.lines.length * S.textLineHeight + 24 : 0;
  const cardH = 2 * S.cardPad + (chipsH ? chipsH + 18 : 0) + fineH;
  const areaTop = S.margin;
  const areaBottom = S.height - S.margin - 36;
  const cardH2 = Math.min(cardH, areaBottom - areaTop);
  const cardY = areaTop + Math.max(0, (areaBottom - areaTop - cardH2) / 2);
  const cardX = S.width - S.margin - S.cardWidth;

  const chipOriginX = cardX + S.cardPad;
  const chipOriginY = cardY + S.cardPad;
  const placedChips = chips.map((c) => ({ ...c, x: chipOriginX + c.x, y: chipOriginY + c.y }));
  const fineTop = chipOriginY + (chipsH ? chipsH + 18 : 0) + 12;
  const fineLines: Line[] = fine.lines.map((text, i) => ({
    text,
    x: chipOriginX + 12,
    y: fineTop + 12 + (i + 1) * S.textLineHeight - 8,
  }));

  const claimBlockH = claimLines.length * claimLH;
  const claimTop = areaTop + Math.max(0, (areaBottom - areaTop - claimBlockH) / 2);
  const lines: Line[] = claimLines.map((text, i) => ({
    text,
    x: S.margin,
    y: claimTop + (i + 1) * claimLH - Math.round(claimPx * 0.22),
  }));
  const lastLineW = claimLines.length
    ? measure(claimLines[claimLines.length - 1] ?? '', claimPx, 600, 'sans')
    : 0;

  return {
    claimPx,
    claimLines: lines,
    card: { x: cardX, y: cardY, w: S.cardWidth, h: cardH2 },
    chips: placedChips,
    fineLines,
    tether: {
      from: {
        x: S.margin + Math.min(lastLineW, leftW) + 8,
        y: claimTop + claimBlockH - claimLH / 2,
      },
      to: { x: cardX, y: cardY + cardH2 / 2 },
    },
    footer: {
      host: input.host,
      date: formatShareDate(input.date),
      y: S.height - S.margin + 8,
    },
    moreChips: input.chips.length - shown,
  };
}
