// Show all catches (SPEC F6, DESIGN.md "Show all rail"): the page dims with a cutout around every
// counted claim, a tether fans from each claim to its entry in the rail, J and K step through them
// with no animation, Enter expands the selected entry in place and Esc exits.

import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  bezierPath,
  pageOffsetLabel,
  rectCenter,
  selectedId,
  tetherCurve,
  type ShowAllState,
} from '../core';
import { claimRect, markerRect } from '../dom/rects';
import { ChipView } from '../ui/components/catch-parts';
import { IconButton, Keys } from '../ui/components/controls';
import { CardContent } from './CardContent';
import type { CatchModel } from './model';

interface Props {
  models: readonly CatchModel[];
  state: ShowAllState;
  hostname: string;
  pressed: string | null;
  helpOpen: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: () => void;
  onExit: () => void;
  announce: (text: string) => void;
  styleRoot: () => Element | null;
}

const SHEET_MAX = 899;

export function ShowAll({
  models,
  state,
  hostname,
  pressed,
  helpOpen,
  onSelect,
  onToggleExpand,
  onExit,
  announce,
  styleRoot,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const entryRefs = useRef(new Map<string, HTMLElement>());
  const cutRefs = useRef(new Map<string, SVGRectElement>());
  const pathRefs = useRef(new Map<string, SVGGElement>());
  const dotRefs = useRef(new Map<string, SVGCircleElement>());
  const glowRefs = useRef(new Map<string, SVGPathElement>());
  const lineRefs = useRef(new Map<string, SVGPathElement>());
  const selected = selectedId(state);

  // Page offsets are measured once on entry so the labels do not change while the page scrolls.
  const offsets = useMemo(() => {
    const out = new Map<string, string>();
    const base = state.restoreScrollY ?? window.scrollY;
    for (const m of models) {
      const r = markerRect(m.marker);
      const inView = r && r.top >= 0 && r.bottom <= window.innerHeight;
      out.set(
        m.id,
        !r
          ? 'Not on the page'
          : inView
            ? 'On screen'
            : pageOffsetLabel(r.top + window.scrollY - base),
      );
    }
    return out;
  }, [models, state.restoreScrollY]);

  // Selection side effects: bring the claim and its entry into view, no animation (bible P1).
  useLayoutEffect(() => {
    if (!selected) return;
    const model = models.find((m) => m.id === selected);
    const el = model?.marker.claimEl.deref();
    if (el?.isConnected)
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    entryRefs.current.get(selected)?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    if (model) {
      announce(
        `Catch ${String(state.selected + 1)} of ${String(models.length)}: ${model.claimText}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    railRef.current?.focus({ preventScroll: true });
  }, []);

  // Empty rail leaves by itself after 1.5 s.
  useEffect(() => {
    if (models.length > 0) return;
    const t = setTimeout(onExit, 1500);
    return () => {
      clearTimeout(t);
    };
  }, [models.length, onExit]);

  // One rAF loop: cutouts follow their claims, tethers follow claim and entry.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const rail = railRef.current;
      const list = listRef.current;
      if (rail && list) {
        const sheet = window.innerWidth <= SHEET_MAX;
        const railRect = rail.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        const reads = models.map((m) => {
          const mr = markerRect(m.marker);
          const cr = claimRect(m.marker, mr);
          const entry = entryRefs.current.get(m.id)?.querySelector('.cl-entry__card');
          const er = entry?.getBoundingClientRect();
          return { m, mr, cr, er };
        });
        for (const { m, mr, cr, er } of reads) {
          const cut = cutRefs.current.get(m.id);
          if (cut) {
            if (cr && cr.bottom > 0 && cr.top < window.innerHeight) {
              cut.setAttribute('x', String(cr.left - 4));
              cut.setAttribute('y', String(cr.top - 4));
              cut.setAttribute('width', String(cr.right - cr.left + 8));
              cut.setAttribute('height', String(cr.bottom - cr.top + 8));
            } else {
              cut.setAttribute('width', '0');
              cut.setAttribute('height', '0');
            }
          }
          const g = pathRefs.current.get(m.id);
          if (!g) continue;
          const visible =
            mr &&
            er &&
            mr.bottom > 0 &&
            mr.top < window.innerHeight &&
            er.bottom > listRect.top &&
            er.top < listRect.bottom &&
            mr.right < (sheet ? window.innerWidth : railRect.left);
          if (!visible) {
            g.style.display = 'none';
            continue;
          }
          g.style.display = '';
          const from = { x: mr.right, y: rectCenter(mr).y };
          const to = sheet
            ? {
                x: Math.min(Math.max(rectCenter(mr).x, 16), window.innerWidth - 16),
                y: railRect.top,
              }
            : { x: er.left, y: er.top + Math.min(24, er.height / 2) };
          const d = bezierPath(
            tetherCurve(
              sheet ? { x: rectCenter(mr).x, y: mr.bottom } : from,
              to,
              sheet ? 'below' : 'right',
            ),
          );
          glowRefs.current.get(m.id)?.setAttribute('d', d);
          lineRefs.current.get(m.id)?.setAttribute('d', d);
          const dot = dotRefs.current.get(m.id);
          dot?.setAttribute('cx', String(sheet ? rectCenter(mr).x : from.x));
          dot?.setAttribute('cy', String(sheet ? mr.bottom : from.y));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [models]);

  const count = models.length;
  return (
    <>
      <svg className="cl-scrim" aria-hidden onClick={onExit}>
        <defs>
          <mask id="cl-scrim-mask" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {models.map((m) => (
              <rect
                key={m.id}
                ref={(el) => {
                  if (el) cutRefs.current.set(m.id, el);
                  else cutRefs.current.delete(m.id);
                }}
                rx={4}
                fill="black"
                width={0}
                height={0}
              />
            ))}
          </mask>
        </defs>
        <rect
          className="cl-scrim-fill"
          x="0"
          y="0"
          width="100%"
          height="100%"
          mask="url(#cl-scrim-mask)"
        />
      </svg>
      <svg className="cl-svg" aria-hidden>
        {models.map((m) => (
          <g
            key={m.id}
            className="cl-tether"
            data-selected={m.id === selected}
            data-dim={m.id !== selected}
            style={{ display: 'none' }}
            ref={(el) => {
              if (el) pathRefs.current.set(m.id, el);
              else pathRefs.current.delete(m.id);
            }}
          >
            <path
              className="cl-tether-glow"
              ref={(el) => {
                if (el) glowRefs.current.set(m.id, el);
                else glowRefs.current.delete(m.id);
              }}
            />
            <path
              className="cl-tether-line"
              ref={(el) => {
                if (el) lineRefs.current.set(m.id, el);
                else lineRefs.current.delete(m.id);
              }}
            />
            <circle
              className="cl-tether-dot"
              r={2}
              ref={(el) => {
                if (el) dotRefs.current.set(m.id, el);
                else dotRefs.current.delete(m.id);
              }}
            />
          </g>
        ))}
      </svg>
      <div
        ref={railRef}
        className="cl-rail"
        role="region"
        aria-label="Catches on this page"
        tabIndex={-1}
        data-testid="rail"
      >
        <div className="cl-rail__head">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div>
              <h2 className="cl-rail__title">
                {count === 0
                  ? 'No catches on this page.'
                  : `${String(count)} ${count === 1 ? 'catch' : 'catches'} on this page`}
              </h2>
              {count > 0 && (
                <p className="cl-rail__sub">Step through them. Nothing on the page moves.</p>
              )}
            </div>
            <div style={{ margin: '-4px -6px 0 0' }}>
              <IconButton label="Exit Show all" keys="Esc" onClick={onExit}>
                <X size={16} strokeWidth={1.5} aria-hidden />
              </IconButton>
            </div>
          </div>
          <div className="cl-hintbar" aria-label="Keyboard shortcuts">
            <span>
              <Keys keys={['J']} pressed={pressed} />
              <Keys keys={['K']} pressed={pressed} />
              Step
            </span>
            <span>
              <Keys keys={['Enter']} pressed={pressed} />
              Expand
            </span>
            <span>
              <Keys keys={['Esc']} pressed={pressed} />
              Exit
            </span>
            <span aria-label="Shortcuts">
              <Keys keys={['?']} pressed={pressed} />
              Shortcuts
            </span>
          </div>
        </div>
        <ol className="cl-rail__list" ref={listRef}>
          {models.map((m) => {
            const isSel = m.id === selected;
            const open = state.expandedId === m.id;
            return (
              <li
                key={m.id}
                className="cl-entry"
                data-selected={isSel}
                data-catch-id={m.id}
                ref={(el) => {
                  if (el) entryRefs.current.set(m.id, el);
                  else entryRefs.current.delete(m.id);
                }}
              >
                <span className="cl-entry__dot" aria-hidden />
                <span className="cl-offsetlabel">{offsets.get(m.id)}</span>
                <button
                  type="button"
                  className="cl-entry__card"
                  aria-current={isSel ? 'true' : undefined}
                  aria-expanded={open}
                  onClick={() => {
                    if (isSel) onToggleExpand();
                    else onSelect(m.id);
                  }}
                >
                  <span className="cl-entry__claim">{m.claimText}</span>
                  <span className="cl-chips cl-entry__chips">
                    {m.chips.slice(0, 3).map((c, i) => (
                      <ChipView key={`${c.kind}-${c.label}-${String(i)}`} chip={c} />
                    ))}
                    {m.chips.length > 3 && (
                      <span className="cl-tag">+{m.chips.length - 3} more</span>
                    )}
                  </span>
                </button>
                {open && (
                  <div className="cl-entry__open">
                    <CardContent
                      model={m}
                      hostname={hostname}
                      styleRoot={styleRoot}
                      headingId={`cl-entry-${m.id}`}
                      announce={announce}
                      hideClaim
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {helpOpen && (
          <div className="cl-help" role="dialog" aria-label="Shortcuts">
            <h3>Shortcuts</h3>
            <dl>
              <Keys keys={['Alt', 'Shift', 'C']} />
              <dd>Show all catches on this page</dd>
              <Keys keys={['J']} />
              <dd>Next catch</dd>
              <Keys keys={['K']} />
              <dd>Previous catch</dd>
              <Keys keys={['Enter']} />
              <dd>Expand the selected entry</dd>
              <Keys keys={['Esc']} />
              <dd>Exit and restore your place</dd>
            </dl>
          </div>
        )}
      </div>
    </>
  );
}
