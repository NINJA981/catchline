// The workspace: the pasted page as readable text, with every marker as a button. Opening one
// plays the signature moment: the footnote lifts off, flies up a tether and docks as the catch
// card beside (wide screens) or under (phones) the claim. Geometry, timing and copy come from the
// shared engine module; the card is the same component the landing page uses.

import {
  cardDockPoint,
  chooseVariant,
  markerExitPoint,
  tetherCurve,
  truncate,
  type Catch,
  type Rect,
  type Side,
} from '@catchline/core';
import {
  catchPlainText,
  buildCard,
  finePrintFor,
  type CardAction,
  type CardView,
} from '../shared/card';
import { clear, h, reducedMotion } from '../shared/dom';
import { playMoment, type Moment } from '../shared/flight';
import { createTether, setTether, type Tether } from '../shared/tether';
import type { ScanResult } from '../engine/scan';
import { hostFromDocument, prefersShareSheet, shareOrSave } from './share';

export interface Workspace {
  el: HTMLElement;
  open(id: string, via: 'pointer' | 'key' | 'list'): void;
  close(returnFocus: boolean): void;
  /** Move to the next or previous counted catch (J and K). */
  step(delta: 1 | -1): void;
  selected(): string | null;
  destroy(): void;
}

export interface WorkspaceOptions {
  scan: ScanResult;
  sourceLabel: string;
  onSelect(id: string | null): void;
}

const WIDE = '(min-width: 900px)';

export function createWorkspace(opts: WorkspaceOptions): Workspace {
  const { scan } = opts;
  const host = hostFromDocument(scan.parsed.doc) ?? 'pasted page';
  const wide = window.matchMedia(WIDE);

  const markerEls = new Map<string, HTMLButtonElement>();
  const blockEls: HTMLElement[] = [];

  // Reader.
  const flow = h('div', { class: 'reader__flow' });
  for (const block of scan.reader.blocks) {
    const el = h('p', { class: `rd rd--${block.kind}`, 'data-block': String(block.index) });
    if (block.kind === 'heading') {
      el.setAttribute('role', 'heading');
      el.setAttribute('aria-level', String(Math.min(6, block.level + 1)));
    }
    if (block.fontPx !== null && block.fontPx < 13) {
      // The page's own small print, at the size the page set it (never below 9 px).
      el.classList.add('rd--small');
      el.style.fontSize = `${String(Math.max(9, Math.round(block.fontPx * 10) / 10))}px`;
      el.style.lineHeight = `${String(Math.round(Math.max(9, block.fontPx) * 1.45))}px`;
    }
    for (const run of block.runs) {
      if (!run.markerId) {
        el.append(run.text);
        continue;
      }
      const c = scan.byMarker.get(run.markerId);
      const btn = h(
        'button',
        {
          class: `marker${c?.marker.glyph.startsWith('sup:') ? ' marker--sup' : ''}${c?.counted ? '' : ' marker--quiet'}`,
          type: 'button',
          'data-marker': run.markerId,
          'aria-expanded': 'false',
          'aria-label': `Show the catch for ${c ? truncate(c.marker.claimText, 60) : 'this claim'}`,
        },
        run.text,
      );
      markerEls.set(run.markerId, btn);
      el.append(btn);
    }
    blockEls.push(el);
    flow.append(el);
  }
  if (scan.reader.truncated) {
    flow.append(
      h(
        'p',
        { class: 'rd rd--note t-caption t-subtle' },
        'This page is long. The first part is shown; every catch in it is still found.',
      ),
    );
  }

  const tether: Tether = createTether();
  tether.svg.setAttribute('hidden', '');
  const rail = h('aside', { class: 'rail', 'aria-label': 'Catch card' });
  const reader = h(
    'div',
    { class: 'reader' },
    h(
      'div',
      { class: 'reader__bar' },
      h('span', { class: 't-label' }, 'Page text'),
      h('span', { class: 't-caption t-subtle' }, opts.sourceLabel),
    ),
    flow,
  );
  const stage = h('div', { class: 'stage' }, tether.svg, reader, rail);
  const el = h('section', { class: 'workspace', 'aria-label': 'Page text with catches' }, stage);

  // State.
  let current: {
    c: Catch;
    view: CardView;
    claimBlock: HTMLElement;
    footnoteBlock: HTMLElement | null;
  } | null = null;
  let moment: Moment | null = null;
  let opened = false;
  let side: Side = 'right';

  const rel = (node: Element): Rect => {
    const s = stage.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    return {
      left: r.left - s.left - stage.clientLeft,
      top: r.top - s.top - stage.clientTop,
      right: r.right - s.left - stage.clientLeft,
      bottom: r.bottom - s.top - stage.clientTop,
    };
  };

  function place(): void {
    if (!current) return;
    const { view, claimBlock } = current;
    const isWide = wide.matches;
    if (isWide) {
      if (view.el.parentElement !== rail) rail.replaceChildren(view.el);
      view.el.classList.remove('card--inline');
      // Centre the card on the marker so the tether runs nearly level across the page.
      const marker = markerEls.get(current.c.marker.id);
      const mid = marker ? (rel(marker).top + rel(marker).bottom) / 2 : rel(claimBlock).top;
      const max = Math.max(0, stage.clientHeight - view.el.offsetHeight);
      view.el.style.top = `${String(Math.round(Math.min(Math.max(0, mid - view.el.offsetHeight / 2), max)))}px`;
    } else {
      if (view.el.previousElementSibling !== claimBlock) claimBlock.after(view.el);
      view.el.classList.add('card--inline');
      view.el.style.top = '';
    }
    const marker = markerEls.get(current.c.marker.id);
    if (!marker) return;
    const m = rel(marker);
    const c = rel(view.el);
    side = isWide ? 'right' : 'below';
    const size = { width: c.right - c.left, height: c.bottom - c.top };
    const dock = cardDockPoint({ x: c.left, y: c.top, side }, size);
    setTether(tether, tetherCurve(markerExitPoint(m, side), dock, side));
    tether.svg.removeAttribute('hidden');
  }

  function clearOpenState(): void {
    if (!current) return;
    markerEls.get(current.c.marker.id)?.setAttribute('aria-expanded', 'false');
    current.footnoteBlock?.classList.remove('ghost');
    current.claimBlock.classList.remove('rd--open');
    current.view.el.remove();
    tether.svg.setAttribute('hidden', '');
    clear(rail);
    current = null;
  }

  function actionsFor(c: Catch): CardAction[] {
    const useSheet = prefersShareSheet();
    const list: CardAction[] = [
      {
        id: 'copy',
        label: 'Copy text',
        icon: 'copy',
        run() {
          const btn = current?.view.actions.get('copy');
          navigator.clipboard.writeText(catchPlainText(c, scan.analysis)).then(
            () => {
              flash(btn, 'Copied', 'Copy text');
            },
            () => {
              flash(btn, "Couldn't copy", 'Copy text');
            },
          );
        },
      },
      {
        id: 'image',
        label: useSheet ? 'Share image' : 'Save image',
        icon: useSheet ? 'share-2' : 'download',
        run() {
          const btn = current?.view.actions.get('image');
          const idle = useSheet ? 'Share image' : 'Save image';
          shareOrSave(scan, c, host, useSheet).then(
            (r) => {
              if (r.kind === 'saved') flash(btn, 'Saved', idle, r.fileName);
              else if (r.kind === 'shared') flash(btn, 'Shared', idle);
            },
            () => {
              flash(btn, "Couldn't make the image", idle);
            },
          );
        },
      },
    ];
    if (c.match.footnoteId) {
      list.push({
        id: 'footnote',
        label: 'Go to footnote',
        icon: 'corner-left-up',
        run() {
          current?.footnoteBlock?.scrollIntoView({
            block: 'center',
            behavior: reducedMotion() ? 'auto' : 'smooth',
          });
        },
      });
    }
    list.push({
      id: 'close',
      label: 'Close',
      icon: 'x',
      run() {
        api.close(true);
      },
    });
    return list;
  }

  const status = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  el.append(status);

  function flash(
    btn: HTMLButtonElement | undefined,
    text: string,
    idle: string,
    detail?: string,
  ): void {
    if (!btn) return;
    const label = btn.querySelector('span');
    if (!label) return;
    label.textContent = text;
    status.textContent = detail ? `${text} ${detail}` : text;
    window.setTimeout(() => {
      label.textContent = idle;
    }, 1500);
  }

  const api: Workspace = {
    el,
    open(id, via) {
      const c = scan.byMarker.get(id);
      const markerBtn = markerEls.get(id);
      if (!c || !markerBtn) return;
      if (current?.c.marker.id === id) {
        if (via === 'pointer') api.close(false);
        return;
      }
      moment?.finish();
      clearOpenState();

      const idxBlock = scan.reader.markerBlock.get(id);
      const claimBlock = idxBlock === undefined ? undefined : blockEls[idxBlock];
      if (!claimBlock) return;
      const fnIdx = c.match.footnoteId
        ? scan.reader.footnoteBlock.get(c.match.footnoteId)
        : undefined;
      const footnoteBlock = fnIdx === undefined ? null : (blockEls[fnIdx] ?? null);
      const fnFont = fnIdx === undefined ? null : (scan.reader.blocks[fnIdx]?.fontPx ?? null);

      // Bring the claim into view first (instant: the flight starts from live positions).
      const r = claimBlock.getBoundingClientRect();
      if (r.top < 72 || r.bottom > window.innerHeight - 24) {
        claimBlock.scrollIntoView({ block: 'center', behavior: 'auto' });
      }

      const view = buildCard(c, scan.analysis, actionsFor(c));
      current = { c, view, claimBlock, footnoteBlock };
      markerBtn.setAttribute('aria-expanded', 'true');
      claimBlock.classList.add('rd--open');
      footnoteBlock?.classList.add('ghost');
      place();
      opts.onSelect(id);

      const fine = finePrintFor(c, scan.analysis);
      const hasFlight = footnoteBlock !== null && fine !== null;
      // Keyboard stepping never animates (DESIGN.md, Shortcut Map); a catch with no footnote has
      // nothing to fly, so it gets the short version.
      const variant =
        via === 'key'
          ? 'reduced'
          : hasFlight
            ? chooseVariant({ reducedMotion: reducedMotion(), firstOpen: !opened })
            : reducedMotion()
              ? 'reduced'
              : 'short';
      opened = true;
      moment = playMoment(
        {
          stage,
          card: view.el,
          chips: view.chips,
          fine: view.fine,
          footnote: footnoteBlock,
          footnoteFontPx: fnFont,
          footnoteText: fine ? truncate(fine.text, 240) : '',
          tether,
          side,
        },
        variant,
      );
      void moment.finished.then(() => {
        if (current?.c.marker.id === id && via !== 'key') view.el.focus({ preventScroll: true });
      });
      if (via === 'key') moment.finish();
    },
    close(returnFocus) {
      moment?.finish();
      const id = current?.c.marker.id;
      clearOpenState();
      opts.onSelect(null);
      if (returnFocus && id) markerEls.get(id)?.focus();
    },
    step(delta) {
      const counted = scan.ordered.filter((c) => c.counted);
      if (counted.length === 0) return;
      const at = counted.findIndex((c) => c.marker.id === current?.c.marker.id);
      const next =
        counted[
          (at === -1 ? (delta === 1 ? 0 : counted.length - 1) : at + delta + counted.length) %
            counted.length
        ];
      if (next) api.open(next.marker.id, 'key');
    },
    selected() {
      return current?.c.marker.id ?? null;
    },
    destroy() {
      moment?.finish();
      ro.disconnect();
      wide.removeEventListener('change', onWide);
      el.remove();
    },
  };

  flow.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLButtonElement>('button[data-marker]');
    if (t?.dataset.marker) api.open(t.dataset.marker, 'pointer');
  });

  const onWide = (): void => {
    moment?.finish();
    place();
  };
  wide.addEventListener('change', onWide);
  const ro = new ResizeObserver(() => {
    place();
  });
  ro.observe(stage);

  return api;
}
