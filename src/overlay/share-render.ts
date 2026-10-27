// Renders the share image locally on a canvas (SPEC F8, DESIGN.md "Share card"): 1200 x 630,
// Ledger Paper, the claim at 64px, the card at 1.5x, a Prussian tether between them, hostname and
// capture date in mono. No page screenshot, no network, nothing leaves the device.

import { layoutShare, SHARE, splitFigures, type Face, type ShareLayout } from '../core';
import type { CatchModel } from './model';

const SANS = '"Catchline Schibsted", "Schibsted Grotesk Variable", system-ui, sans-serif';
const MONO = '"Catchline Commit", "Commit Mono", ui-monospace, monospace';

interface Palette {
  paper: string;
  sheet: string;
  sheet2: string;
  rule: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  prussian: string;
  wash: string;
  glow: string;
}

function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    paper: v('--cl-ledger-paper'),
    sheet: v('--cl-sheet'),
    sheet2: v('--cl-sheet-2'),
    rule: v('--cl-rule'),
    ink: v('--cl-ink'),
    inkMuted: v('--cl-ink-muted'),
    inkSubtle: v('--cl-ink-subtle'),
    prussian: v('--cl-prussian'),
    wash: v('--cl-prussian-wash'),
    glow: v('--cl-tether-glow'),
  };
}

export interface ShareSource {
  model: CatchModel;
  hostname: string;
  date: Date;
}

/** Loads the faces the canvas will use; resolves even when a face is unavailable. */
async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`600 64px "Catchline Schibsted"`),
      document.fonts.load(`500 20px "Catchline Schibsted"`),
      document.fonts.load(`400 20px "Catchline Schibsted"`),
      document.fonts.load(`400 20px "Catchline Commit"`),
      document.fonts.load(`500 20px "Catchline Commit"`),
    ]);
  } catch {
    // Fall back to the system faces already named in the font stacks.
  }
}

function font(px: number, weight: number, face: 'sans' | 'mono'): string {
  return `${String(weight)} ${String(px)}px ${face === 'mono' ? MONO : SANS}`;
}

/** Draws words in the sans face and figures in the mono face; returns the width. */
function mixedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  px: number,
  weight: number,
): number {
  let w = 0;
  for (const seg of splitFigures(text)) {
    ctx.font = seg.figure ? font(px * 0.92, 400, 'mono') : font(px, weight, 'sans');
    w += ctx.measureText(seg.text).width;
  }
  return w;
}

function drawMixed(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  weight: number,
): void {
  let cx = x;
  for (const seg of splitFigures(text)) {
    ctx.font = seg.figure ? font(px * 0.92, 400, 'mono') : font(px, weight, 'sans');
    ctx.fillText(seg.text, cx, y);
    cx += ctx.measureText(seg.text).width;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function shareFor(source: ShareSource): { claim: string; fine: string } {
  const m = source.model;
  return { claim: m.claimText, fine: m.shownText ?? m.claimText };
}

export async function renderShare(
  source: ShareSource,
  styleRoot: Element,
  doc: Document = document,
): Promise<Blob> {
  await ensureFonts();
  const canvas = doc.createElement('canvas');
  canvas.width = SHARE.width;
  canvas.height = SHARE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  const pal = readPalette(styleRoot);

  const measure = (text: string, px: number, weight: number, face: Face): number => {
    if (face === 'mixed') return mixedWidth(ctx, text, px, weight);
    ctx.font = font(px, weight, face);
    return ctx.measureText(text).width;
  };
  const { claim, fine } = shareFor(source);
  const L: ShareLayout = layoutShare(measure, {
    claim,
    chips: source.model.chips,
    fine,
    host: source.hostname,
    date: source.date,
  });

  // Canvas.
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, SHARE.width, SHARE.height);

  // Claim.
  ctx.fillStyle = pal.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(L.claimPx, 600, 'sans');
  ctx.letterSpacing = `${String(-0.03 * L.claimPx)}px`;
  for (const line of L.claimLines) ctx.fillText(line.text, line.x, line.y);
  ctx.letterSpacing = '0px';

  // Card.
  roundRect(ctx, L.card.x, L.card.y, L.card.w, L.card.h, 12);
  ctx.save();
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = pal.sheet;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.rule;
  roundRect(ctx, L.card.x + 0.5, L.card.y + 0.5, L.card.w - 1, L.card.h - 1, 12);
  ctx.stroke();

  // Tether: 1.5px line over a 6px glow, dot at the claim end.
  const { from, to } = L.tether;
  const off = Math.min(120, Math.abs(to.x - from.x) * 0.4);
  for (const [w, color] of [
    [9, pal.glow],
    [2.25, pal.prussian],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(from.x + off, from.y, to.x - off, to.y, to.x, to.y);
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.fillStyle = pal.prussian;
  ctx.beginPath();
  ctx.arc(from.x, from.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Chips.
  for (const c of L.chips) {
    roundRect(ctx, c.x, c.y, c.w, c.h, 6);
    ctx.fillStyle = pal.sheet2;
    ctx.fill();
    ctx.fillStyle = pal.ink;
    drawMixed(ctx, c.label, c.x + 12, c.y + c.h / 2 + 6, 17.5, 500);
  }
  if (L.moreChips > 0) {
    const last = L.chips[L.chips.length - 1];
    if (last) {
      ctx.fillStyle = pal.inkMuted;
      ctx.font = font(15, 400, 'sans');
      ctx.fillText(`+${String(L.moreChips)} more`, last.x + last.w + 10, last.y + 24);
    }
  }

  // Fine print block.
  if (L.fineLines.length) {
    const first = L.fineLines[0];
    const lastLine = L.fineLines[L.fineLines.length - 1];
    if (first && lastLine) {
      const bx = L.card.x + SHARE.cardPad;
      const by = first.y - SHARE.textLineHeight + 4 - 12;
      const bh = lastLine.y + 12 + 8 - by;
      roundRect(ctx, bx, by, SHARE.cardWidth - 2 * SHARE.cardPad, bh, 6);
      ctx.fillStyle = pal.paper;
      ctx.fill();
      ctx.strokeStyle = pal.rule;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = pal.ink;
    ctx.font = font(SHARE.textFontPx, 400, 'sans');
    for (const line of L.fineLines) ctx.fillText(line.text, line.x, line.y);
  }

  // Footer: hostname and date in mono left, wordmark right.
  ctx.fillStyle = pal.inkSubtle;
  ctx.font = font(18, 400, 'mono');
  ctx.fillText(`${L.footer.host}  ${L.footer.date}`, SHARE.margin, L.footer.y);
  ctx.fillStyle = pal.ink;
  ctx.font = font(20, 600, 'sans');
  ctx.textAlign = 'right';
  ctx.fillText('Catchline', SHARE.width - SHARE.margin, L.footer.y);
  ctx.textAlign = 'left';

  return new Promise<Blob>((ok, fail) => {
    canvas.toBlob((b) => {
      if (b) ok(b);
      else fail(new Error('Could not encode the image'));
    }, 'image/png');
  });
}
