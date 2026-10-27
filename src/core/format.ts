// Display formatting shared by the overlay, popup and share card. Pure.

/** "3,140 px below" / "820 px above" / "On screen" for the flight tag and the rail spine. */
export function pageOffsetLabel(deltaPx: number): string {
  const n = Math.round(Math.abs(deltaPx));
  if (n < 1) return 'On screen';
  return `${n.toLocaleString('en-US')} px ${deltaPx > 0 ? 'below' : 'above'}`;
}

/** "catchline-carrier-example-2026-10-20.png" (DESIGN.md share card "Saved" copy). */
export function shareFileName(host: string, date: Date): string {
  const slug = host
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.[a-z]{2,}$/, (tld) => (tld === '.com' ? '' : tld))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `catchline-${slug || 'page'}-${y}-${m}-${d}.png`;
}

/** "Show all offer details (612 words)" (DESIGN.md many-to-one state). */
export function expanderLabel(words: number): string {
  return `Show all offer details (${words.toLocaleString('en-US')} ${words === 1 ? 'word' : 'words'})`;
}
