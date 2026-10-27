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
