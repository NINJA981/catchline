// Catchline web app (/app/): paste promo text or page HTML, or open a bundled sample, and see the
// catch next to every claim. The engine is the extension's own (src/core, via the @catchline/core
// alias). Everything runs in this page: no uploads, no fetches, works offline after the first load.

import { cardState, ledgerRows, splitFigures, toCatchSummary, type Catch } from '@catchline/core';
import { InputError } from '../engine/parse';
import { scanInput, type ScanResult } from '../engine/scan';
import { clear, h, icon, reducedMotion } from '../shared/dom';
import { registerServiceWorker } from '../shared/sw';
import { SAMPLES, loadSample, sampleById, type SampleMeta } from './samples';
import { createWorkspace, type Workspace } from './workspace';

const SKELETON_DELAY_MS = 150;
const SKELETON_MIN_MS = 300;

function must<T extends Element>(
  selector: string,
  kind: abstract new () => T,
  root: ParentNode = document,
): T {
  const el = root.querySelector(selector);
  if (!(el instanceof kind)) throw new Error(`Missing element: ${selector}`);
  return el;
}

const source = must('#source', HTMLTextAreaElement);
const scanBtn = must('#scan', HTMLButtonElement);
const sampleBtn = must('#sample-btn', HTMLButtonElement);
const clearBtn = must('#clear', HTMLButtonElement);
const fileInput = must('#file', HTMLInputElement);
const result = must('#result', HTMLElement);
const samplesDetails = must('#samples', HTMLDetailsElement);
const sampleList = must('#sample-list', HTMLElement);
const installBtn = must('#install', HTMLButtonElement);
const offlineNote = must('#offline-note', HTMLElement);

let workspace: Workspace | null = null;
/** Set by doneState; show() adopts it after the old workspace is torn down. */
let pending: Workspace | null = null;
let runId = 0;
let lastRun: (() => void) | null = null;

function figureNodes(text: string): (Node | string)[] {
  return splitFigures(text).map((s) => (s.figure ? h('span', { class: 'fig' }, s.text) : s.text));
}

function setBusy(busy: boolean): void {
  result.setAttribute('aria-busy', String(busy));
  scanBtn.toggleAttribute('data-busy', busy);
}

function show(...nodes: Node[]): void {
  workspace?.destroy();
  workspace = null;
  clear(result);
  result.append(...nodes);
  workspace = pending;
  pending = null;
}

/* ---------- states ---------- */

function emptyState(): Node {
  return h(
    'div',
    { class: 'panel panel--empty' },
    h('h2', { class: 't-h2' }, 'Nothing scanned yet'),
    h(
      'p',
      { class: 't-body t-muted prose' },
      'Paste a promo page or its text above, or start with a sample page. Catchline finds every *, †, ‡, § and ¶ claim, superscript number and “Terms apply” phrase, and pulls its conditions up next to it.',
    ),
    h(
      'div',
      { class: 'panel__actions' },
      h(
        'button',
        {
          class: 'btn btn--secondary',
          type: 'button',
          onclick: () => void runSample(SAMPLES[0]?.id ?? ''),
        },
        'Try a sample',
      ),
    ),
  );
}

function skeleton(): Node {
  const row = (): HTMLElement =>
    h(
      'div',
      { class: 'skeleton__row' },
      h('span', { class: 'skeleton__bar skeleton__bar--wide' }),
      h('span', { class: 'skeleton__bar' }),
    );
  return h(
    'div',
    { class: 'skeleton', 'aria-hidden': 'true' },
    h('span', { class: 'skeleton__bar skeleton__bar--head' }),
    h(
      'div',
      { class: 'skeleton__ledger' },
      h('span', { class: 'skeleton__bar' }),
      h('span', { class: 'skeleton__bar' }),
      h('span', { class: 'skeleton__bar' }),
    ),
    row(),
    row(),
    row(),
  );
}

function errorState(message: string, retry: (() => void) | null): Node {
  return h(
    'div',
    { class: 'panel panel--danger', role: 'alert' },
    h(
      'div',
      { class: 'panel__title' },
      icon('triangle-alert'),
      h('h2', { class: 't-h3' }, 'Catchline couldn’t scan that'),
    ),
    h('p', { class: 't-body prose' }, message),
    h(
      'div',
      { class: 'panel__actions' },
      retry
        ? h('button', { class: 'btn btn--secondary', type: 'button', onclick: retry }, 'Try again')
        : null,
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: resetAll }, 'Clear'),
    ),
  );
}

function tagFor(c: Catch): string | null {
  const s = cardState(c);
  return s.kind === 'matched' || s.kind === 'likely' || s.kind === 'many-to-one' ? s.tag : null;
}

function catchRow(c: Catch, onPick: (id: string) => void): HTMLElement {
  const sum = toCatchSummary(c);
  const state = cardState(c);
  const second =
    sum.chipLabels.length > 0
      ? sum.chipLabels.join(', ')
      : state.kind === 'not-found'
        ? 'No footnote found'
        : state.kind === 'external'
          ? 'Terms are on another page'
          : c.reference
            ? 'Reference footnote'
            : 'No terms found';
  const tag = tagFor(c);
  return h(
    'li',
    null,
    h(
      'button',
      {
        class: 'catch-row catch-row--button',
        type: 'button',
        'data-catch': c.marker.id,
        onclick: () => {
          onPick(c.marker.id);
        },
      },
      h('span', { class: 'catch-row__claim t-ui' }, c.marker.claimText),
      h('span', { class: 'catch-row__chips t-caption t-muted' }, second),
      tag ? h('span', { class: 'tag' }, tag) : null,
    ),
  );
}

function doneState(scan: ScanResult, label: string): Node {
  const counted = scan.ordered.filter((c) => c.counted);
  const others = scan.ordered.filter((c) => !c.counted);
  const frag = document.createDocumentFragment();

  if (scan.analysis.catches.length === 0) {
    frag.append(
      h(
        'div',
        { class: 'panel panel--empty' },
        h('h2', { class: 't-h2' }, 'No fine print found'),
        h(
          'p',
          { class: 't-body t-muted prose' },
          'Catchline looks for *, †, ‡, § and ¶ claims, superscript numbers and phrases like “Terms apply”. If you pasted a long page, try the part with the offer and its fine print. Fine print inside images can’t be read.',
        ),
        h(
          'div',
          { class: 'panel__actions' },
          h(
            'button',
            {
              class: 'btn btn--secondary',
              type: 'button',
              onclick: () => void runSample(SAMPLES[0]?.id ?? ''),
            },
            'Try a sample',
          ),
        ),
      ),
    );
    return frag;
  }

  const head = h(
    'header',
    { class: 'result__head' },
    h(
      'h2',
      { class: 'result__summary' },
      ...figureNodes(counted.length > 0 ? scan.summary : 'No catches found'),
    ),
    h('p', { class: 't-caption t-subtle' }, label),
  );
  frag.append(head);

  if (counted.length === 0) {
    const anyMatched = scan.ordered.some((c) => c.match.footnoteId !== null);
    frag.append(
      h(
        'p',
        { class: 't-body t-muted prose' },
        anyMatched
          ? 'These footnotes don’t mention fees, terms or conditions.'
          : 'Catchline found the claims but no footnote for them. The terms may be in an image or on another page.',
      ),
    );
  }

  const ws = createWorkspace({
    scan,
    sourceLabel: label,
    onSelect: (id) => {
      for (const b of result.querySelectorAll<HTMLElement>('[data-catch]')) {
        if (b.dataset.catch === id) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      }
    },
  });
  const pick = (id: string): void => {
    ws.open(id, 'list');
  };

  const rows = ledgerRows(scan.rollup);
  const ledger =
    rows.length > 0
      ? h(
          'dl',
          { class: 'ledger result__ledger', 'aria-label': 'What the catches add up to' },
          ...rows.map((r) =>
            h(
              'div',
              { class: 'ledger__row' },
              h('dt', { class: 't-ui t-muted' }, r.first ? r.category : ''),
              h('dd', { class: 't-ui' }, ...figureNodes(r.value)),
            ),
          ),
        )
      : null;

  const list = h(
    'div',
    { class: 'result__list' },
    counted.length > 0 ? h('h3', { class: 't-h3' }, 'Catches') : null,
    counted.length > 0
      ? h('ul', { class: 'catch-list' }, ...counted.map((c) => catchRow(c, pick)))
      : null,
    others.length > 0
      ? h(
          'details',
          { class: 'others', open: counted.length === 0 },
          h('summary', { class: 't-label' }, `Other footnotes (${String(others.length)})`),
          h('ul', { class: 'catch-list' }, ...others.map((c) => catchRow(c, pick))),
        )
      : null,
  );

  frag.append(h('div', { class: 'result__grid' }, ledger, list), ws.el);
  pending = ws;
  return frag;
}

/* ---------- running ---------- */

async function run(getRaw: () => Promise<{ raw: string; label: string }>): Promise<void> {
  const id = ++runId;
  let skeletonAt = 0;
  setBusy(true);
  const timer = window.setTimeout(() => {
    if (id !== runId) return;
    skeletonAt = performance.now();
    show(skeleton());
  }, SKELETON_DELAY_MS);
  const finish = async (render: () => void): Promise<void> => {
    window.clearTimeout(timer);
    if (skeletonAt) {
      const left = SKELETON_MIN_MS - (performance.now() - skeletonAt);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
    }
    if (id !== runId) return;
    render();
    setBusy(false);
  };
  try {
    const { raw, label } = await getRaw();
    // Let the browser paint the pressed button before the synchronous scan.
    await new Promise((r) => setTimeout(r, 0));
    const scan = scanInput(raw);
    await finish(() => {
      const node = doneState(scan, label);
      show(node);
      samplesDetails.open = false;
      const top = result.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.6) {
        result.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    });
  } catch (e) {
    const message =
      e instanceof InputError
        ? e.message
        : 'Something went wrong reading that. Try pasting the text of the page instead.';
    await finish(() => {
      show(errorState(message, lastRun));
      if (e instanceof InputError && e.kind === 'empty') source.focus();
    });
  }
}

function runPasted(): void {
  const raw = source.value;
  lastRun = runPasted;
  void run(() =>
    Promise.resolve({
      raw,
      label: /<\s*[a-z!]/i.test(raw) ? 'Pasted page HTML' : 'Pasted text',
    }),
  );
}

async function runSample(id: string): Promise<void> {
  const meta: SampleMeta | undefined = sampleById(id);
  if (!meta) return;
  lastRun = () => void runSample(id);
  history.replaceState(null, '', `#sample=${id}`);
  await run(async () => {
    const raw = await loadSample(id);
    source.value = raw;
    return { raw, label: `Sample: ${meta.label}. Specimen page, not a real offer.` };
  });
}

function resetAll(): void {
  runId++;
  setBusy(false);
  source.value = '';
  lastRun = null;
  history.replaceState(null, '', location.pathname);
  show(emptyState());
  samplesDetails.open = true;
  source.focus();
}

/* ---------- wiring ---------- */

for (const s of SAMPLES) {
  sampleList.append(
    h(
      'li',
      null,
      h(
        'button',
        {
          class: 'sample',
          type: 'button',
          onclick: () => void runSample(s.id),
        },
        h('span', { class: 't-label' }, s.label),
        h('span', { class: 't-caption t-muted' }, s.blurb),
      ),
    ),
  );
}

scanBtn.addEventListener('click', runPasted);
sampleBtn.addEventListener('click', () => {
  const first = SAMPLES[0];
  if (first) void runSample(first.id);
});
clearBtn.addEventListener('click', resetAll);
source.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runPasted();
  }
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  lastRun = null;
  void run(async () => {
    const raw = await file.text();
    source.value = raw;
    return { raw, label: 'Saved page from your device' };
  });
});

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null;
  if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const card = t?.closest('.card');
  if (e.key === 'Escape') {
    if (workspace?.selected()) {
      e.preventDefault();
      workspace.close(true);
    }
    return;
  }
  if (!workspace) return;
  if (e.key === 'j' || e.key === 'J') {
    e.preventDefault();
    workspace.step(1);
  } else if (e.key === 'k' || e.key === 'K') {
    e.preventDefault();
    workspace.step(-1);
  } else if (card) {
    const map: Record<string, string> = { c: 'copy', s: 'image', g: 'footnote' };
    const action = map[e.key.toLowerCase()];
    if (action) card.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click();
  }
});

// Install prompt (Chrome and Edge, Android). Other browsers use their own menu.
let deferredPrompt: (Event & { prompt(): Promise<void> }) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as Event & { prompt(): Promise<void> };
  installBtn.hidden = false;
});
installBtn.addEventListener('click', () => {
  void deferredPrompt?.prompt();
  installBtn.hidden = true;
  deferredPrompt = null;
});
window.addEventListener('appinstalled', () => {
  installBtn.hidden = true;
});

registerServiceWorker('../sw.js', () => {
  offlineNote.textContent = 'Ready to use offline.';
});

// Start state: a linked sample (#sample=id) or the empty state.
function linkedSample(): string | undefined {
  const id = /^#sample=([\w-]+)$/.exec(location.hash)?.[1];
  return id && sampleById(id) ? id : undefined;
}
const linked = linkedSample();
if (linked) void runSample(linked);
else show(emptyState());
window.addEventListener('hashchange', () => {
  const id = linkedSample();
  if (id) void runSample(id);
});
