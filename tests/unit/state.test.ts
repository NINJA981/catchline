import {
  buildRollup,
  cardState,
  derivePopupView,
  glyphDisplay,
  initialShowAll,
  isTypingTarget,
  keyToAction,
  likelyReason,
  MAX_VISIBLE_CHIPS,
  selectedId,
  showAllReducer,
  SKELETON_DELAY_MS,
  visibleChips,
  type Catch,
  type PopupInput,
  type ShowAllState,
} from '../../src/core';
import { analyzeFixture, analyzeHtml, byClaim, parse } from './helpers';

describe('card state (DESIGN.md catch card)', () => {
  it('marks a strong match "Matched"', () => {
    const a = analyzeFixture('synthetic/carrier-specimen.html');
    expect(cardState(byClaim(a, '$0/mo'))).toEqual({ kind: 'matched', tag: 'Matched' });
  });

  it('marks a middling match "Likely match" and explains why', () => {
    const a = analyzeFixture('synthetic/plan-cards.html');
    const s = cardState(byClaim(a, '$30/mo'));
    expect(s.kind).toBe('likely');
    if (s.kind === 'likely') {
      expect(s.tag).toBe('Likely match');
      expect(s.reason).toBe('Likely match. Same * symbol in small print, 3 candidates.');
    }
  });

  it('shows many-to-one footnotes with their own state', () => {
    const a = analyzeFixture('synthetic/many-to-one.html');
    const s = cardState(byClaim(a, 'Save $10/mo'));
    expect(s.kind).toBe('many-to-one');
  });

  it('says "No footnote found" without guessing (AC-F2.4)', () => {
    const a = analyzeFixture('synthetic/not-found.html');
    const s = cardState(byClaim(a, '$12.99'));
    expect(s.kind).toBe('not-found');
    if (s.kind === 'not-found') expect(s.copy).toMatch(/^No footnote found for this \*\./);
  });

  it('points at the other page when the terms are elsewhere', () => {
    const a = analyzeFixture('synthetic/not-found.html');
    const s = cardState(byClaim(a, 'Two months free'));
    expect(s).toMatchObject({ kind: 'external', host: 'tidewell.example' });
    if (s.kind === 'external') {
      expect(s.copy).toBe('Terms are on another page: tidewell.example/legal/offer-details');
    }
  });

  it('prints the marker the way the page does', () => {
    expect(glyphDisplay('*')).toBe('*');
    expect(glyphDisplay('sup:3')).toBe('3');
    expect(glyphDisplay('uni:12')).toBe('¹²');
    expect(glyphDisplay('phrase')).toBe('note');
  });

  it('words the likely-match reason from signals', () => {
    const base = analyzeHtml('<body><p>Fee*</p><footer>* $5 fee.</footer></body>')
      .catches[0] as Catch;
    const withSignals = (signals: string[]): Catch => ({
      ...base,
      match: { ...base.match, signals },
    });
    expect(
      likelyReason(withSignals(['same-glyph-block-start', 'legal-container', 'candidates:2'])),
    ).toBe("Likely match. Same * symbol in the page's legal section, 2 candidates.");
    expect(likelyReason(withSignals(['same-glyph-block-start', 'hidden-text']))).toBe(
      'Likely match. Same * symbol, found in collapsed text.',
    );
    expect(likelyReason(withSignals(['phrase-legal-section']))).toBe(
      'Likely match. Nearest legal section on the page.',
    );
    expect(likelyReason(withSignals([]))).toBe('Likely match.');
  });

  it('collapses chips past the sixth into "+N more"', () => {
    const ten = Array.from({ length: 10 }, (_, i) => i);
    expect(MAX_VISIBLE_CHIPS).toBe(6);
    expect(visibleChips(ten, false)).toEqual({ shown: ten.slice(0, 6), more: 4 });
    expect(visibleChips(ten, true)).toEqual({ shown: ten, more: 0 });
    expect(visibleChips(ten.slice(0, 6), false)).toEqual({ shown: ten.slice(0, 6), more: 0 });
    expect(visibleChips([], false)).toEqual({ shown: [], more: 0 });
  });
});

describe('popup view (AC-F10.2)', () => {
  const catches = analyzeFixture('synthetic/carrier-specimen.html').catches;
  const input = (patch: Partial<PopupInput> = {}): PopupInput => ({
    url: 'https://carrier.example/plans',
    disabledHosts: [],
    hasHostPermission: true,
    rollup: buildRollup(1, catches, 0),
    scannerError: false,
    elapsedMs: 500,
    ...patch,
  });

  it('shows the rollup when there are catches', () => {
    const v = derivePopupView(input());
    expect(v).toMatchObject({
      kind: 'success',
      heading: '3 catches',
      summary: '3 catches: $35 + 36 months hidden',
    });
  });

  it('uses the singular for one catch', () => {
    const one = buildRollup(1, catches.slice(0, 1), 0);
    expect(derivePopupView(input({ rollup: one }))).toMatchObject({ heading: '1 catch' });
  });

  it('is blank, then a skeleton after 150 ms, while scanning', () => {
    expect(derivePopupView(input({ rollup: null, elapsedMs: 0 })).kind).toBe('blank');
    expect(derivePopupView(input({ rollup: null, elapsedMs: SKELETON_DELAY_MS - 1 })).kind).toBe(
      'blank',
    );
    expect(derivePopupView(input({ rollup: null, elapsedMs: SKELETON_DELAY_MS })).kind).toBe(
      'loading',
    );
  });

  it('shows the empty state when the scan found nothing', () => {
    const empty = buildRollup(1, [], 0);
    expect(derivePopupView(input({ rollup: empty })).kind).toBe('empty');
  });

  it('shows reference-only pages as zero catches with a note', () => {
    const refs = analyzeFixture('synthetic/reference-footnotes.html').catches;
    const v = derivePopupView(input({ rollup: buildRollup(1, refs, 0) }));
    expect(v.kind).toBe('reference-only');
    if (v.kind === 'reference-only') expect(v.listed).toBe(refs.length);
  });

  it('shows the restricted state for browser pages and stores', () => {
    for (const url of ['chrome://extensions', 'https://chromewebstore.google.com/x', null]) {
      expect(derivePopupView(input({ url })).kind).toBe('restricted');
    }
  });

  it('asks for permission on Firefox before anything else about the page', () => {
    expect(derivePopupView(input({ hasHostPermission: false })).kind).toBe('permission');
    expect(derivePopupView(input({ hasHostPermission: false, url: 'about:blank' })).kind).toBe(
      'restricted',
    );
  });

  it('shows the disabled state with the host name', () => {
    const v = derivePopupView(input({ disabledHosts: ['carrier.example'] }));
    expect(v).toEqual({
      kind: 'disabled',
      host: 'carrier.example',
      copy: 'Catchline is off on carrier.example. Turn it on to scan this page.',
    });
  });

  it('shows the error state when the scanner does not answer', () => {
    expect(derivePopupView(input({ scannerError: true, rollup: null })).kind).toBe('error');
  });

  it('never uses a middle dot in popup copy', () => {
    const views = [
      derivePopupView(input()),
      derivePopupView(input({ url: 'chrome://x' })),
      derivePopupView(input({ rollup: buildRollup(1, [], 0) })),
      derivePopupView(input({ scannerError: true })),
    ];
    expect(JSON.stringify(views)).not.toContain('·');
  });
});

describe('Show all state (F6)', () => {
  const ids = ['a', 'b', 'c'];
  const open = (): ShowAllState =>
    showAllReducer(initialShowAll, { type: 'enter', ids, scrollY: 420 });

  it('opens on the first catch and remembers the scroll position', () => {
    const s = open();
    expect(s).toMatchObject({ open: true, selected: 0, restoreScrollY: 420 });
    expect(selectedId(s)).toBe('a');
  });

  it('steps with next and prev and stops at the ends', () => {
    let s = open();
    s = showAllReducer(s, { type: 'prev' });
    expect(selectedId(s)).toBe('a');
    s = showAllReducer(showAllReducer(showAllReducer(s, { type: 'next' }), { type: 'next' }), {
      type: 'next',
    });
    expect(selectedId(s)).toBe('c');
    s = showAllReducer(s, { type: 'prev' });
    expect(selectedId(s)).toBe('b');
  });

  it('expands and collapses the selected card, and closes it when selection moves', () => {
    let s = showAllReducer(open(), { type: 'toggle-expand' });
    expect(s.expandedId).toBe('a');
    s = showAllReducer(s, { type: 'toggle-expand' });
    expect(s.expandedId).toBeNull();
    s = showAllReducer(showAllReducer(s, { type: 'toggle-expand' }), { type: 'next' });
    expect(s.expandedId).toBeNull();
  });

  it('selects by id and ignores unknown ids', () => {
    const s = showAllReducer(open(), { type: 'select', id: 'c' });
    expect(selectedId(s)).toBe('c');
    expect(showAllReducer(s, { type: 'select', id: 'zzz' })).toBe(s);
  });

  it('exits to the initial state', () => {
    expect(showAllReducer(open(), { type: 'exit' })).toEqual(initialShowAll);
  });

  it('ignores navigation while closed or empty', () => {
    expect(showAllReducer(initialShowAll, { type: 'next' })).toBe(initialShowAll);
    const empty = showAllReducer(initialShowAll, { type: 'enter', ids: [], scrollY: 0 });
    expect(showAllReducer(empty, { type: 'next' })).toBe(empty);
    expect(showAllReducer(empty, { type: 'toggle-expand' })).toBe(empty);
    expect(selectedId(empty)).toBeNull();
  });
});

describe('Show all keys (AC-F6.2, AC-F6.3)', () => {
  const body = parse('<body></body>').body;

  it('maps J K Enter Esc and ?', () => {
    expect(keyToAction('j', body)).toBe('next');
    expect(keyToAction('J', body)).toBe('next');
    expect(keyToAction('ArrowDown', body)).toBe('next');
    expect(keyToAction('k', body)).toBe('prev');
    expect(keyToAction('ArrowUp', body)).toBe('prev');
    expect(keyToAction('Enter', body)).toBe('toggle-expand');
    expect(keyToAction('Escape', body)).toBe('exit');
    expect(keyToAction('?', body)).toBe('help');
    expect(keyToAction('x', body)).toBeNull();
  });

  it.each([
    ['<input type="text">', true],
    ['<input>', true],
    ['<input type="search">', true],
    ['<input type="email">', true],
    ['<textarea></textarea>', true],
    ['<select><option>a</option></select>', true],
    ['<div contenteditable="true">x</div>', true],
    ['<div contenteditable>x</div>', true],
    ['<div contenteditable="plaintext-only">x</div>', true],
    ['<input type="checkbox">', false],
    ['<input type="radio">', false],
    ['<input type="button">', false],
    ['<button>go</button>', false],
    ['<div contenteditable="false">x</div>', false],
    ['<p>text</p>', false],
  ])('typing target %s -> %s', (html, expected) => {
    const doc = parse(`<body>${html}</body>`);
    const el = doc.body.firstElementChild;
    expect(isTypingTarget(el)).toBe(expected);
  });

  it('ignores J/K while the user is typing in the host page', () => {
    const doc = parse('<body><input type="text"></body>');
    const input = doc.querySelector('input');
    expect(keyToAction('j', input)).toBeNull();
    expect(keyToAction('Escape', input)).toBeNull();
  });

  it('treats a missing target as not typing', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(keyToAction('j', null)).toBe('next');
  });
});
