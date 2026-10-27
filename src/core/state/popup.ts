// Popup view state (DESIGN.md popup state table, AC-F10.2). Pure: inputs in, one state out.

import { rollupSummary } from '../rollup';
import type { TabRollup } from '../types';
import { hostnameOf, isHostDisabled, isRestrictedUrl } from '../url';

export interface PopupInput {
  url: string | null;
  disabledHosts: readonly string[];
  /** Firefox MV3: host permission not granted yet. */
  hasHostPermission: boolean;
  rollup: TabRollup | null;
  /** The scanner did not answer (tab opened before install) or threw. */
  scannerError: boolean;
  /** ms since the popup opened; the skeleton waits 150 ms before showing. */
  elapsedMs: number;
}

export type PopupView =
  | { kind: 'blank' }
  | { kind: 'loading' }
  | { kind: 'restricted'; copy: string }
  | { kind: 'permission'; copy: string; action: string }
  | { kind: 'disabled'; host: string; copy: string }
  | { kind: 'error'; copy: string; action: string }
  | { kind: 'empty'; copy: string; action: string }
  | { kind: 'reference-only'; listed: number; copy: string }
  | { kind: 'success'; rollup: TabRollup; heading: string; summary: string };

export const SKELETON_DELAY_MS = 150;

export function derivePopupView(input: PopupInput): PopupView {
  if (isRestrictedUrl(input.url)) {
    return { kind: 'restricted', copy: "Browsers don't let extensions read this page." };
  }
  if (!input.hasHostPermission) {
    return {
      kind: 'permission',
      copy: 'Catchline needs permission to read pages to find fine print.',
      action: 'Allow on all sites',
    };
  }
  const host = hostnameOf(input.url);
  if (host && isHostDisabled(host, input.disabledHosts)) {
    return {
      kind: 'disabled',
      host,
      copy: `Catchline is off on ${host}. Turn it on to scan this page.`,
    };
  }
  if (input.scannerError) {
    return {
      kind: 'error',
      copy: "Catchline can't reach this page yet. Reload the page to scan it.",
      action: 'Reload page',
    };
  }
  const r = input.rollup;
  if (!r) return input.elapsedMs >= SKELETON_DELAY_MS ? { kind: 'loading' } : { kind: 'blank' };
  if (r.listed === 0) {
    return {
      kind: 'empty',
      copy: 'No fine print on this page. Catchline checks every page for *, †, ‡ and ¹ claims, and the badge shows a count when it finds one.',
      action: 'Open welcome page',
    };
  }
  if (r.catches === 0) {
    return {
      kind: 'reference-only',
      listed: r.listed,
      copy: "These footnotes don't mention fees, terms or conditions.",
    };
  }
  return {
    kind: 'success',
    rollup: r,
    heading: `${String(r.catches)} ${r.catches === 1 ? 'catch' : 'catches'}`,
    summary: rollupSummary(r),
  };
}
