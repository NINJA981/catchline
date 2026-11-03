// Message sender -> tab id. The sender is untrusted shape-wise (and @webext-core's sender type
// depends on optional @types/chrome), so read it defensively.

/** The tab id of a message sent from a tab's top frame, or null (subframes, extension pages). */
export function topFrameTabId(sender: unknown): number | null {
  if (!sender || typeof sender !== 'object') return null;
  const s = sender as { tab?: unknown; frameId?: unknown };
  const frameId = typeof s.frameId === 'number' ? s.frameId : 0;
  if (frameId !== 0) return null;
  if (!s.tab || typeof s.tab !== 'object') return null;
  const id = (s.tab as { id?: unknown }).id;
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 ? id : null;
}

/**
 * True for messages from one of the extension's own pages (popup, options). The popup carries no
 * `tab`; a page opened in a tab (as the e2e tests do) does, so the sender's URL decides: an
 * extension page's URL starts with the extension origin, a content script's is the web page's.
 */
export function isExtensionPage(sender: unknown, extensionOrigin: string): boolean {
  if (!sender || typeof sender !== 'object') return false;
  const s = sender as { tab?: unknown; url?: unknown };
  if (typeof s.url === 'string') return s.url.startsWith(extensionOrigin);
  return !s.tab;
}
