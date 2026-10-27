import { browser } from 'wxt/browser';
import { applyBadge, BADGE_BACKGROUND, BADGE_TEXT, type BadgeApi } from '../../src/adapters/badge';
import { topFrameTabId } from '../../src/adapters/sender';
import {
  buildRollup,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type TabRollup,
} from '../../src/core';
import { createRescanObserver } from '../../src/dom/observe';
import { FONT_STYLE_ID, fontFaceCss, registerFonts } from '../../src/dom/fonts';
import { clearTabRollup, getTabRollup, rollupKey, setTabRollup } from '../../src/storage/rollup';
import {
  getSettings,
  setHostEnabled,
  updateSettings,
  watchSettings,
} from '../../src/storage/settings';
import { parse } from './helpers';

function recordingBadge() {
  const calls: [string, unknown][] = [];
  const api: BadgeApi = {
    setBadgeText: (d) => {
      calls.push(['text', d]);
    },
    setTitle: (d) => {
      calls.push(['title', d]);
    },
    setBadgeBackgroundColor: (d) => {
      calls.push(['bg', d]);
    },
    setBadgeTextColor: (d) => {
      calls.push(['fg', d]);
    },
  };
  return { api, calls };
}

const rollup = (tabId: number, catches: number): TabRollup => ({
  ...buildRollup(tabId, [], 99),
  catches,
  listed: catches,
});

describe('badge adapter (F7)', () => {
  it('shows the count, the tooltip and the token colors', async () => {
    const { api, calls } = recordingBadge();
    await applyBadge(api, 4, rollup(4, 3));
    expect(calls).toEqual([
      ['text', { tabId: 4, text: '3' }],
      ['title', { tabId: 4, title: '3 catches' }],
      ['bg', { tabId: 4, color: BADGE_BACKGROUND }],
      ['fg', { tabId: 4, color: BADGE_TEXT }],
    ]);
  });

  it('clears the badge for a null rollup and sets only text and title', async () => {
    const { api, calls } = recordingBadge();
    await applyBadge(api, 9, null);
    expect(calls).toEqual([
      ['text', { tabId: 9, text: '' }],
      ['title', { tabId: 9, title: 'Catchline' }],
    ]);
  });

  it('works without setBadgeTextColor (Firefox older than 63 has none)', async () => {
    const { api } = recordingBadge();
    delete api.setBadgeTextColor;
    await expect(applyBadge(api, 1, rollup(1, 2))).resolves.toBeUndefined();
  });

  it('colors are hex strings the badge API accepts', () => {
    expect(BADGE_BACKGROUND).toMatch(/^#[0-9a-f]{6}$/);
    expect(BADGE_TEXT).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('message sender', () => {
  it('returns the tab id of a top-frame message', () => {
    expect(topFrameTabId({ tab: { id: 12 }, frameId: 0 })).toBe(12);
    expect(topFrameTabId({ tab: { id: 12 } })).toBe(12);
  });

  it.each([
    [null],
    [undefined],
    ['x'],
    [{}],
    [{ tab: null }],
    [{ tab: { id: '1' } }],
    [{ tab: { id: -1 } }],
    [{ tab: { id: 1.5 } }],
    [{ tab: { id: 3 }, frameId: 2 }],
  ])('rejects %j', (sender) => {
    expect(topFrameTabId(sender)).toBeNull();
  });
});

describe('settings storage (F11, AC-F11.1)', () => {
  it('returns defaults before anything is saved', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves a patch and reads it back sanitized', async () => {
    const next = await updateSettings({ runOn: 'on-click', theme: 'dark' });
    expect(next).toMatchObject({ runOn: 'on-click', theme: 'dark', badge: true });
    expect(await getSettings()).toEqual(next);
  });

  it('writes under the key the every-page scanner reads directly', async () => {
    await updateSettings({ badge: false });
    const raw = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
    expect(raw[SETTINGS_STORAGE_KEY]).toMatchObject({ badge: false, version: 1 });
  });

  it('repairs corrupt stored values instead of throwing', async () => {
    await browser.storage.local.set({
      [SETTINGS_STORAGE_KEY]: { runOn: 'nonsense', disabledHosts: 'x' },
    });
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('turns a site off and on, once, with normalized hosts', async () => {
    expect(await setHostEnabled('https://WWW.Example.com/path', false)).toEqual(['example.com']);
    expect(await setHostEnabled('example.com', false)).toEqual(['example.com']);
    expect(await setHostEnabled('other.test', false)).toEqual(['example.com', 'other.test']);
    expect(await setHostEnabled('www.example.com', true)).toEqual(['other.test']);
  });

  it('notifies watchers with sanitized settings and stops after unsubscribe', async () => {
    const seen: string[] = [];
    const stop = watchSettings((s) => seen.push(s.theme));
    await updateSettings({ theme: 'light' });
    await updateSettings({ theme: 'dark' });
    stop();
    await updateSettings({ theme: 'system' });
    expect(seen).toEqual(['light', 'dark']);
  });

  it('never stores a key unless the user added one', async () => {
    await updateSettings({ theme: 'dark' });
    const raw = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
    expect(raw[SETTINGS_STORAGE_KEY]).not.toHaveProperty('byoKey');
  });
});

describe('rollup storage (SPEC §9)', () => {
  it('keys by tab id', () => {
    expect(rollupKey(5)).toBe('session:rollup:5');
  });

  it('round-trips a rollup per tab and clears it', async () => {
    await setTabRollup(rollup(1, 2));
    await setTabRollup(rollup(2, 5));
    expect((await getTabRollup(1))?.catches).toBe(2);
    expect((await getTabRollup(2))?.catches).toBe(5);
    await clearTabRollup(1);
    expect(await getTabRollup(1)).toBeNull();
    expect((await getTabRollup(2))?.catches).toBe(5);
  });

  it('returns null for a missing, malformed or mismatched value', async () => {
    expect(await getTabRollup(77)).toBeNull();
    await browser.storage.session.set({ [rollupKey(3)]: { catches: 'many' } });
    expect(await getTabRollup(3)).toBeNull();
    await browser.storage.session.set({ [rollupKey(4)]: rollup(99, 1) });
    expect(await getTabRollup(4)).toBeNull();
  });

  it('stores counts and term strings only, with no url field', async () => {
    await setTabRollup(rollup(1, 2));
    const json = JSON.stringify(await browser.storage.session.get(null));
    expect(json).not.toMatch(/https?:|url|href/i);
  });
});

describe('fonts (ADR §5.3)', () => {
  const urlFor = (p: string) => `chrome-extension://abc/${p}`;

  it('declares private family names that select nothing on the host page', () => {
    const css = fontFaceCss(urlFor);
    expect(css).toContain('"Catchline Schibsted"');
    expect(css).toContain('"Catchline Commit"');
    expect(css).toContain('chrome-extension://abc/fonts/schibsted-grotesk-latin-wght-normal.woff2');
    expect(css).not.toMatch(/https?:\/\//);
    expect(css.match(/@font-face/g)).toHaveLength(3);
    expect(css).not.toMatch(/(^|\})\s*[a-z.#*][^@{]*\{/i); // only @font-face blocks
  });

  it('injects one style element, idempotently', () => {
    const doc = parse('<html><head></head><body></body></html>');
    const first = registerFonts(doc, urlFor);
    const second = registerFonts(doc, urlFor);
    expect(second).toBe(first);
    expect(doc.querySelectorAll(`#${FONT_STYLE_ID}`)).toHaveLength(1);
    expect(first.hasAttribute('data-catchline')).toBe(true);
    expect(first.parentElement?.tagName).toBe('HEAD');
  });
});

describe('rescan observer (ADR §3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(found: () => number, options = {}) {
    const doc = parse('<body><div id="host"></div></body>');
    const calls = { n: 0 };
    const obs = createRescanObserver(
      doc.body,
      () => {
        calls.n++;
        return found();
      },
      options,
    );
    const mutate = async (parent: Element = doc.getElementById('host') as Element) => {
      parent.appendChild(doc.createElement('p'));
      await vi.advanceTimersByTimeAsync(0);
    };
    return { doc, calls, obs, mutate };
  }

  it('debounces a burst of mutations into one rescan after 300 ms', async () => {
    const { calls, mutate } = setup(() => 0);
    await mutate();
    await mutate();
    await mutate();
    await vi.advanceTimersByTimeAsync(299);
    expect(calls.n).toBe(0);
    await vi.advanceTimersByTimeAsync(2);
    expect(calls.n).toBe(1);
  });

  it('ignores mutations inside Catchline UI', async () => {
    const { doc, calls, mutate } = setup(() => 0);
    const ui = doc.createElement('div');
    ui.setAttribute('data-catchline', '');
    doc.body.appendChild(ui);
    await vi.advanceTimersByTimeAsync(400);
    calls.n = 0;
    await mutate(ui);
    await vi.advanceTimersByTimeAsync(400);
    expect(calls.n).toBe(0);
  });

  it('stops observing after the idle budget and re-arms on demand', async () => {
    const { calls, obs, mutate } = setup(() => 0, { maxIdleBatches: 3, debounceMs: 10 });
    for (let i = 0; i < 5; i++) {
      await mutate();
      await vi.advanceTimersByTimeAsync(20);
    }
    expect(calls.n).toBe(3);
    expect(obs.active).toBe(false);
    obs.rearm();
    expect(obs.active).toBe(true);
    await mutate();
    await vi.advanceTimersByTimeAsync(20);
    expect(calls.n).toBe(4);
  });

  it('resets the idle budget whenever a rescan finds something new', async () => {
    let found = 1;
    const { calls, obs, mutate } = setup(() => found, { maxIdleBatches: 2, debounceMs: 10 });
    for (let i = 0; i < 4; i++) {
      await mutate();
      await vi.advanceTimersByTimeAsync(20);
    }
    expect(obs.active).toBe(true);
    found = 0;
    for (let i = 0; i < 2; i++) {
      await mutate();
      await vi.advanceTimersByTimeAsync(20);
    }
    expect(obs.active).toBe(false);
    expect(calls.n).toBe(6);
  });

  it('disconnect cancels a pending rescan', async () => {
    const { calls, obs, mutate } = setup(() => 0);
    await mutate();
    obs.disconnect();
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.n).toBe(0);
    expect(obs.active).toBe(false);
  });
});
