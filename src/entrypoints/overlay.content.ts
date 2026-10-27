// The on-demand overlay (ADR 0001 section 2): injected with scripting.executeScript the first time a
// card or Show all is requested on a page, so React is never parsed on pages the user does not use
// Catchline on. It shares the scanner's isolated world and reads the scan through the bridge.

import { defineContentScript } from 'wxt/utils/define-content-script';
import { getBridge } from '../overlay/bridge';
import { mountOverlay } from '../overlay/mount';

export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  main(ctx) {
    const bridge = getBridge();
    if (!bridge) return;
    if (bridge.overlay) {
      // Injected twice (a second request raced the first): hand over the parked request.
      const pending = bridge.pending;
      bridge.pending = null;
      if (pending) bridge.overlay.dispatch(pending);
      return;
    }
    const handle = mountOverlay(bridge, { fonts: true });
    ctx.onInvalidated(() => {
      handle.destroy();
    });
  },
});
