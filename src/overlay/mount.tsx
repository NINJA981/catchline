// Mounts the overlay into a closed-off shadow root on the host page (ADR 0001 section 5). Used by
// the runtime-injected content script and by the welcome page's specimen.

import { createRoot } from 'react-dom/client';
import { registerFonts } from '../dom/fonts';
import baseTokens from '../ui/base.tokens.css?inline';
import components from '../ui/components.css?inline';
import type { Bridge, OverlayHandle } from './bridge';
import overlayCss from './overlay.css?inline';
import { OverlayApp } from './OverlayApp';

export interface MountOptions {
  /** Register the private @font-face names on the host document (content scripts). */
  fonts: boolean;
  doc?: Document;
}

export function mountOverlay(bridge: Bridge, opts: MountOptions): OverlayHandle {
  const doc = opts.doc ?? document;
  if (opts.fonts) registerFonts(doc, bridge.urlFor);

  const host = doc.createElement('catchline-overlay');
  host.setAttribute('data-catchline', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = `${baseTokens}\n${components}\n${overlayCss}`;
  shadow.appendChild(style);
  const rootEl = doc.createElement('div');
  rootEl.className = 'cl-root cl-stage';
  shadow.appendChild(rootEl);
  doc.documentElement.appendChild(host);

  const applySettings = () => {
    const s = bridge.getSettings();
    if (s.theme === 'light' || s.theme === 'dark') host.setAttribute('data-theme', s.theme);
    else host.removeAttribute('data-theme');
    rootEl.setAttribute('data-motion', s.motion);
  };
  applySettings();
  const offSettings = bridge.onSettings(applySettings);

  const root = createRoot(rootEl);
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    offSettings();
    root.unmount();
    host.remove();
    bridge.overlay = null;
  };
  root.render(<OverlayApp bridge={bridge} rootRef={{ current: rootEl }} onDestroy={destroy} />);

  return {
    dispatch: (req) => {
      bridge.overlay?.dispatch(req);
    },
    destroy,
  };
}
