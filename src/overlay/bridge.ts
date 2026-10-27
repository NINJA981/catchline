// The seam between the every-page scanner and the on-demand overlay. Both content scripts of one
// extension run in the same isolated world, so a Symbol.for key on globalThis is shared between
// them and invisible to the page (ADR 0001 section 3). The welcome page builds its own bridge and
// mounts the very same overlay. Types only here; no browser APIs.

import type { Analysis, Settings } from '../core';

export type OverlayRequest =
  { kind: 'card'; id: string } | { kind: 'show-all' } | { kind: 'close' };

export interface OverlayHandle {
  dispatch: (req: OverlayRequest) => void;
  destroy: () => void;
}

export interface Bridge {
  /** The latest scan, or null before the first one. */
  getAnalysis: () => Analysis | null;
  /** Called after every rescan. Returns an unsubscribe. */
  onAnalysis: (cb: () => void) => () => void;
  getSettings: () => Settings;
  onSettings: (cb: () => void) => () => void;
  /** Hostname for the share image and file name. */
  hostname: string;
  /** Resolves an extension resource such as "fonts/x.woff2". */
  urlFor: (path: string) => string;
  /** Asks the scanner to scan again now (lazy footnotes). */
  rescan: () => void;
  /** Returns focus to the marker hit target of a catch (AC-F5.4). */
  focusMarker: (id: string) => void;
  /** Set by the overlay when it is mounted. */
  overlay: OverlayHandle | null;
  /** A request that arrived before the overlay loaded. */
  pending: OverlayRequest | null;
  /** Listens for the overlay's lifecycle so the scanner can route clicks. */
}

const KEY = Symbol.for('catchline.bridge');

type Holder = { [KEY]?: Bridge };

export function getBridge(): Bridge | undefined {
  return (globalThis as Holder)[KEY];
}

export function setBridge(bridge: Bridge | undefined): void {
  (globalThis as Holder)[KEY] = bridge;
}

/** Routes a request to the overlay if it is loaded, else parks it for the overlay's first mount. */
export function dispatchToOverlay(bridge: Bridge, req: OverlayRequest): boolean {
  if (bridge.overlay) {
    bridge.overlay.dispatch(req);
    return true;
  }
  bridge.pending = req;
  return false;
}

/** Registers (or clears) the mounted overlay and returns the request that was parked for it. */
export function attachOverlay(bridge: Bridge, handle: OverlayHandle | null): OverlayRequest | null {
  bridge.overlay = handle;
  if (!handle) return null;
  const pending = bridge.pending;
  bridge.pending = null;
  return pending;
}
