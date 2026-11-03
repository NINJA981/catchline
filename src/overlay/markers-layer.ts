// Marker hit targets (DESIGN.md "Marker hit target"): a transparent 24px-minimum button centred on
// each detected marker glyph, with a 2px Prussian underline, drawn in Catchline's own shadow layer so
// the host page is never touched. Vanilla DOM on purpose: this runs on every page (ADR 0001).

import type { Catch } from '../core';
import { markerRect } from '../dom/rects';
import baseTokens from '../ui/base.tokens.css?inline';

const CSS = `
:host{all:initial;position:fixed;inset:0;z-index:2147483646;display:block;pointer-events:none;contain:layout style}
.m{position:absolute;left:0;top:0;display:none;padding:0;margin:0;border:0;border-radius:9999px;background:transparent;pointer-events:auto;cursor:pointer;font:inherit}
.m::after{content:'';position:absolute;left:var(--ux);right:var(--ux);bottom:var(--uy);height:2px;border-radius:1px;background:var(--cl-prussian);opacity:.4;transition:opacity var(--dur-1) var(--ease-out)}
.m:hover::after,.m[data-open='true']::after{opacity:1}
.m:focus-visible{outline:2px solid var(--cl-prussian);outline-offset:2px;box-shadow:0 0 0 5px var(--cl-sheet)}
.m::before{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 4px);padding:4px 8px;border-radius:4px;background:var(--cl-ink);color:var(--cl-ledger-paper);font:400 12px/16px var(--cl-font-sans);white-space:nowrap;opacity:0;transform:translate(-50%,2px);pointer-events:none;transition:opacity var(--dur-1) var(--ease-out),transform var(--dur-1) var(--ease-out)}
@media (hover:hover) and (pointer:fine){.m:hover::before{opacity:1;transform:translate(-50%,0);transition-delay:500ms}}
.m:focus-visible::before{opacity:1;transform:translate(-50%,0)}
:host([data-quiet]) .m::after,:host([data-quiet]) .m::before{display:none}
:host([data-quiet]) .m{pointer-events:none}
@media (prefers-reduced-motion:reduce){.m::after,.m::before{transition-duration:.01ms}}
`;

export interface MarkerLayer {
  update(catches: readonly Catch[]): void;
  setQuiet(quiet: boolean): void;
  setTheme(theme: string): void;
  focus(id: string): void;
  destroy(): void;
}

function interactive(c: Catch): boolean {
  return c.counted || (!c.reference && !c.match.footnoteId);
}

export function createMarkerLayer(opts: {
  onOpen: (id: string) => void;
  /** The pointer or keyboard focus reached a marker: a click is likely, so load the overlay now. */
  onIntent?: () => void;
}): MarkerLayer {
  const host = document.createElement('catchline-markers');
  host.setAttribute('data-catchline', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = baseTokens + CSS;
  shadow.appendChild(style);
  document.documentElement.appendChild(host);

  let list: Catch[] = [];
  const buttons = new Map<string, HTMLButtonElement>();
  let queued = false;

  const layout = () => {
    queued = false;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    // Read every rect first, then write.
    const reads = list.map((c) => ({ c, r: markerRect(c.marker) }));
    for (const { c, r } of reads) {
      const b = buttons.get(c.marker.id);
      if (!b) continue;
      if (!r || r.bottom < -40 || r.top > vh + 40 || r.right < -40 || r.left > vw + 40) {
        b.style.display = 'none';
        continue;
      }
      const rw = r.right - r.left;
      const rh = r.bottom - r.top;
      const w = Math.max(24, rw + 8);
      const h = Math.max(24, rh + 8);
      b.style.display = 'block';
      b.style.width = `${String(w)}px`;
      b.style.height = `${String(h)}px`;
      b.style.translate = `${String(r.left - (w - rw) / 2)}px ${String(r.top - (h - rh) / 2)}px`;
      b.style.setProperty('--ux', `${String(Math.max(0, (w - rw) / 2))}px`);
      b.style.setProperty('--uy', `${String(Math.max(0, (h - rh) / 2 - 2))}px`);
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(layout);
  };
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  return {
    update(catches) {
      list = catches.filter(interactive);
      const ids = new Set(list.map((c) => c.marker.id));
      for (const [id, b] of buttons) {
        if (!ids.has(id)) {
          b.remove();
          buttons.delete(id);
        }
      }
      for (const c of list) {
        let b = buttons.get(c.marker.id);
        if (!b) {
          b = document.createElement('button');
          b.type = 'button';
          b.className = 'm';
          const id = c.marker.id;
          b.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            opts.onOpen(id);
          });
          const intent = () => {
            opts.onIntent?.();
          };
          b.addEventListener('pointerenter', intent, { passive: true });
          b.addEventListener('focus', intent, { passive: true });
          shadow.appendChild(b);
          buttons.set(id, b);
        }
        const claim =
          c.marker.claimText.length > 80
            ? `${c.marker.claimText.slice(0, 79)}…`
            : c.marker.claimText;
        b.setAttribute('aria-label', `Show the catch: ${claim}`);
        b.setAttribute('data-tip', 'Show the catch');
      }
      layout();
    },
    setQuiet(quiet) {
      if (quiet) host.setAttribute('data-quiet', '');
      else host.removeAttribute('data-quiet');
      for (const b of buttons.values()) b.tabIndex = quiet ? -1 : 0;
    },
    setTheme(theme) {
      if (theme === 'light' || theme === 'dark') host.setAttribute('data-theme', theme);
      else host.removeAttribute('data-theme');
    },
    focus(id) {
      const b = buttons.get(id);
      if (!b) return;
      if (b.style.display === 'none') b.style.display = 'block';
      b.focus({ preventScroll: true });
    },
    destroy() {
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      host.remove();
      buttons.clear();
    },
  };
}
