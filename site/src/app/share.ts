// "Share this catch": the 1200 x 630 PNG, painted locally on a canvas by the extension's own
// renderer (src/overlay/share-render.ts) from the engine's share layout. Nothing is uploaded.
// On touch devices the file goes to the system share sheet; elsewhere it is saved to disk.

import { shareFileName } from '@catchline/core';
import { buildModels } from '@catchline/overlay-model';
import { renderShare } from '@catchline/share-render';
import type { Catch } from '@catchline/core';
import type { ScanResult } from '../engine/scan';

export type ShareOutcome =
  { kind: 'saved'; fileName: string } | { kind: 'shared' } | { kind: 'cancelled' };

/** The host a page came from, when the pasted markup says so. */
export function hostFromDocument(doc: Document): string | null {
  const candidates = [
    doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    doc.querySelector('meta[property="og:url"]')?.getAttribute('content'),
    ...Array.from(doc.querySelectorAll('a[href^="http"]'))
      .slice(0, 12)
      .map((a) => a.getAttribute('href')),
  ];
  for (const href of candidates) {
    if (!href) continue;
    try {
      const host = new URL(href).hostname.replace(/^www\./, '');
      if (host) return host;
    } catch {
      // not a URL
    }
  }
  return null;
}

export function prefersShareSheet(): boolean {
  if (!window.matchMedia('(pointer: coarse)').matches) return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], 'catch.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export async function renderCatchImage(scan: ScanResult, c: Catch, host: string): Promise<Blob> {
  const model = buildModels(scan.analysis).find((m) => m.id === c.marker.id);
  if (!model) throw new Error('Catch not found');
  return renderShare({ model, hostname: host, date: scan.scannedAt }, document.documentElement);
}

export async function shareOrSave(
  scan: ScanResult,
  c: Catch,
  host: string,
  useShareSheet: boolean,
): Promise<ShareOutcome> {
  const blob = await renderCatchImage(scan, c, host);
  const fileName = shareFileName(host, scan.scannedAt);
  if (useShareSheet) {
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: c.marker.claimText });
      return { kind: 'shared' };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { kind: 'cancelled' };
      // The share sheet refused the file: fall through to a plain download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
  return { kind: 'saved', fileName };
}
