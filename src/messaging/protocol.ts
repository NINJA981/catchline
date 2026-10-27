// Typed messages between scanner, background and popup (ADR §3). Extension-only adapter.
// Payloads carry counts and term strings; never page URLs or full page text.

import { defineExtensionMessaging } from '@webext-core/messaging';
import type { CatchSummary, TabRollup } from '../core';

export type { CatchSummary };

/** What the scanner reports; the background adds the tab id from the sender. */
export type ScanReport = Omit<TabRollup, 'tabId'>;

export interface ProtocolMap {
  /** scanner -> background: a scan finished. */
  reportScan(report: ScanReport): void;
  /** popup -> scanner (tab): live list for the popup. */
  listCatches(): CatchSummary[];
  /** popup or command -> scanner (tab): rescan now. */
  rescan(): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
