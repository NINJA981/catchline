// Card actions: copy text, save or copy the share image, go to the footnote. Browser DOM only; no
// network. Clipboard writes need a user gesture, which every caller has.

import { shareFileName } from '../core';
import type { CatchModel } from './model';

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to the legacy path (pages with a restrictive permissions policy).
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  // Legacy fallback for pages whose permissions policy blocks the async clipboard API.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('Copy failed');
}

export function copyBody(model: CatchModel): string {
  const fine = model.fullText ?? model.shownText ?? '';
  return fine ? `${model.claimText}\n\n${fine}` : model.claimText;
}

export async function copyImage(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

/** Saves through a temporary download link; returns the file name for the status line. */
export function saveBlob(blob: Blob, hostname: string, date = new Date()): string {
  const name = shareFileName(hostname, date);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 4000);
  return name;
}

/** Opens any collapsed <details> around the footnote, then scrolls it to the middle of the view. */
export function goToFootnote(el: Element | null): boolean {
  if (!el?.isConnected) return false;
  for (let p: Element | null = el; p; p = p.parentElement) {
    if (p instanceof HTMLDetailsElement && !p.open) p.open = true;
  }
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  return true;
}

/** "Search the page": scroll to the page's legal section when it has one. */
export function goToLegalSection(doc: Document): boolean {
  const el = doc.querySelector(
    'footer, [class*="legal" i], [class*="disclaimer" i], [class*="fine-print" i], [id*="terms" i]',
  );
  return goToFootnote(el);
}
