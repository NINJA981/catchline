// Typed messages between scanner, background and popup (ADR 0001 section 3). A few lines over
// runtime.sendMessage instead of a library, so the every-page scanner stays small. Payloads carry
// counts, term strings and element-free requests; never page URLs or full page text.

import { browser } from 'wxt/browser';
import type { CatchSummary, TabRollup } from '../core';
import type { OverlayRequest } from '../overlay/bridge';

export type { CatchSummary };

/** What the scanner reports; the background adds the tab id from the sender. */
export type ScanReport = Omit<TabRollup, 'tabId'>;

export interface ProtocolMap {
  /** scanner -> background: a scan finished. */
  reportScan(report: ScanReport): void;
  /** scanner or popup -> background: inject the overlay if needed and hand it a request. */
  openOverlay(data: { req: OverlayRequest; tabId?: number }): void;
  /** popup -> scanner (tab): live list for the popup. */
  listCatches(): CatchSummary[];
  /** popup or background -> scanner (tab): scan now. */
  rescan(): void;
}

type Key = keyof ProtocolMap;
type Args<K extends Key> = Parameters<ProtocolMap[K]>;
type Result<K extends Key> = ReturnType<ProtocolMap[K]>;

interface Envelope {
  catchline: Key;
  args: unknown[];
}

function isEnvelope(v: unknown): v is Envelope {
  return !!v && typeof v === 'object' && typeof (v as Envelope).catchline === 'string';
}

export interface MessageSender {
  tab?: { id?: number };
  frameId?: number;
}

/** To the background (or any extension page). */
export async function sendMessage<K extends Key>(type: K, ...args: Args<K>): Promise<Result<K>> {
  const env: Envelope = { catchline: type, args };
  const r: unknown = await browser.runtime.sendMessage(env);
  return r as Result<K>;
}

/** To the content scripts of one tab. Rejects when none is listening (tab opened before install). */
export async function sendToTab<K extends Key>(
  tabId: number,
  type: K,
  ...args: Args<K>
): Promise<Result<K>> {
  const env: Envelope = { catchline: type, args };
  const r: unknown = await browser.tabs.sendMessage(tabId, env, { frameId: 0 });
  return r as Result<K>;
}

type Handler<K extends Key> = (
  data: Args<K>[0],
  sender: MessageSender,
) => Result<K> | Promise<Result<K>>;

export function onMessage<K extends Key>(type: K, handler: Handler<K>): () => void {
  const listener = (
    message: unknown,
    sender: unknown,
    sendResponse: (r?: unknown) => void,
  ): boolean | undefined => {
    if (!isEnvelope(message) || message.catchline !== type) return undefined;
    Promise.resolve(handler(message.args[0] as Args<K>[0], sender as MessageSender)).then(
      (r) => {
        sendResponse(r);
      },
      () => {
        sendResponse(undefined);
      },
    );
    return true; // answer asynchronously
  };
  browser.runtime.onMessage.addListener(listener);
  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}
