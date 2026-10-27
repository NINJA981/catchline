import {
  createComputedStyleOracle,
  createInlineStyleOracle,
  DEFAULT_SETTINGS,
  expanderLabel,
  guessFamily,
  orderSummaries,
  pageOffsetLabel,
  sanitizeSettings,
  shareFileName,
  toCatchSummary,
  type CatchSummary,
} from '../../src/core';
import { analyzeFixture, parse } from './helpers';

describe('settings schema', () => {
  it('returns defaults for garbage', () => {
    for (const bad of [null, undefined, 3, 'x', [], {}]) {
      expect(sanitizeSettings(bad)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('defaults are on, quiet and local', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      version: 1,
      runOn: 'all-sites',
      disabledHosts: [],
      badge: true,
      plainLine: { enabled: false, provider: 'on-device' },
    });
    expect(DEFAULT_SETTINGS.byoKey).toBeUndefined();
  });

  it('keeps valid values and repairs invalid ones field by field', () => {
    const s = sanitizeSettings({
      runOn: 'on-click',
      theme: 'sepia',
      motion: 'reduce',
      badge: 'yes',
      markCatchesOnPage: false,
      plainLine: { enabled: true, provider: 'carrier-pigeon' },
      extra: 'dropped',
    });
    expect(s).toEqual({
      ...DEFAULT_SETTINGS,
      runOn: 'on-click',
      theme: 'system',
      motion: 'reduce',
      badge: true,
      markCatchesOnPage: false,
      plainLine: { enabled: true, provider: 'on-device' },
    });
    expect(s).not.toHaveProperty('extra');
  });

  it('normalizes, dedupes and bounds disabled hosts', () => {
    const s = sanitizeSettings({
      disabledHosts: [
        'WWW.Example.com',
        'example.com',
        'https://shop.example.org/path',
        42,
        '',
        '   ',
        'a'.repeat(300),
      ],
    });
    expect(s.disabledHosts).toEqual(['example.com', 'shop.example.org']);
  });

  it('trims a BYO key and drops an empty one', () => {
    expect(sanitizeSettings({ byoKey: '  sk-test  ' }).byoKey).toBe('sk-test');
    expect(sanitizeSettings({ byoKey: '   ' }).byoKey).toBeUndefined();
    expect(sanitizeSettings({ byoKey: 5 }).byoKey).toBeUndefined();
  });

  it('is idempotent', () => {
    const once = sanitizeSettings({ runOn: 'on-click', disabledHosts: ['a.com'] });
    expect(sanitizeSettings(once)).toEqual(once);
  });
});

describe('page family guess', () => {
  it('recognises each family from its vocabulary', () => {
    const cases: [string, string][] = [
      [
        'carrier',
        'Unlimited data plan with 5G hotspot and activation fee per line. Autopay discount, trade-in required.',
      ],
      [
        'bank',
        'Credit card with 0% intro APR on purchases, balance transfer fee, annual fee and cash back. Direct deposit bonus.',
      ],
      [
        'retail',
        'Free shipping on your order at checkout. Clearance items excluded, while supplies last. Add to cart for a coupon.',
      ],
      [
        'streaming',
        'Watch movies and series with ads. Free trial for new subscribers, 4K on two screens at a time.',
      ],
      [
        'saas',
        'Per user per seat pricing, billed annually. Workspace API limits, SSO and integrations on the business plan.',
      ],
      [
        'travel',
        'Round-trip fares from select airlines. Baggage fees, blackout dates, hotel nights based on double occupancy.',
      ],
    ];
    for (const [family, text] of cases) expect(guessFamily(text).family, family).toBe(family);
  });

  it('answers unknown when the signal is weak or tied', () => {
    expect(guessFamily('Hello world, nothing to see here.').family).toBe('unknown');
    expect(guessFamily('').family).toBe('unknown');
    expect(guessFamily('wireless plan. APR credit card.', 3).family).toBe('unknown');
  });

  it('reports the score of every family', () => {
    const g = guessFamily('apr apr apr apr');
    expect(Object.keys(g.scores).sort()).toEqual([
      'bank',
      'carrier',
      'retail',
      'saas',
      'streaming',
      'travel',
    ]);
    expect(g.scores.bank).toBe(4);
  });

  it('classifies each synthetic specimen', () => {
    for (const family of ['carrier', 'bank', 'retail', 'streaming', 'saas', 'travel'] as const) {
      expect(analyzeFixture(`synthetic/${family}-specimen.html`).family).toBe(family);
    }
  });
});

describe('format helpers', () => {
  it('labels the page offset between claim and footnote', () => {
    expect(pageOffsetLabel(3140)).toBe('3,140 px below');
    expect(pageOffsetLabel(-820)).toBe('820 px above');
    expect(pageOffsetLabel(0.2)).toBe('On screen');
  });

  it('builds the share file name from host and date', () => {
    const d = new Date(2026, 9, 20);
    expect(shareFileName('www.carrier.example', d)).toBe(
      'catchline-carrier-example-2026-10-20.png',
    );
    expect(shareFileName('Bank.COM', d)).toBe('catchline-bank-2026-10-20.png');
    expect(shareFileName('', d)).toBe('catchline-page-2026-10-20.png');
    expect(shareFileName('a.b.co.uk', new Date(2026, 0, 5))).toBe(
      'catchline-a-b-co-uk-2026-01-05.png',
    );
  });

  it('words the many-to-one expander with the word count (AC-F3.2)', () => {
    expect(expanderLabel(612)).toBe('Show all offer details (612 words)');
    expect(expanderLabel(1)).toBe('Show all offer details (1 word)');
    expect(expanderLabel(1200)).toBe('Show all offer details (1,200 words)');
  });
});

describe('catch summaries', () => {
  const a = analyzeFixture('synthetic/carrier-specimen.html');

  it('carry the claim, the first three chips and the match state', () => {
    const [first] = a.catches;
    expect(first).toBeDefined();
    const s = toCatchSummary(first as NonNullable<typeof first>);
    expect(s.claimText).toBe('$0/mo*');
    expect(s.chipLabels).toEqual([
      '$35 activation',
      '36-month installment agreement',
      'Autopay required',
    ]);
    expect(s.counted).toBe(true);
    expect(s.matched).toBe(true);
    expect(s.confidence).toBeGreaterThan(0.8);
  });

  it('caps chip labels at three', () => {
    const many = analyzeFixture('synthetic/travel-specimen.html').catches[0];
    expect(many && toCatchSummary(many).chipLabels.length).toBeLessThanOrEqual(3);
  });

  it('never carries a URL or the footnote text', () => {
    const json = JSON.stringify(a.catches.map(toCatchSummary));
    expect(json).not.toMatch(/https?:/);
    expect(json).not.toContain('installment agreement on the Pixelstone');
  });

  it('orders counted catches first, keeping page order inside each group', () => {
    const row = (id: string, counted: boolean): CatchSummary => ({
      id,
      claimText: id,
      chipLabels: [],
      confidence: 1,
      counted,
      reference: false,
      matched: true,
    });
    expect(
      orderSummaries([row('a', false), row('b', true), row('c', false), row('d', true)]).map(
        (r) => r.id,
      ),
    ).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('style oracles', () => {
  const doc = parse(
    `<body style="font-size: 16px">
      <p id="px" style="font-size: 11px">a</p>
      <p id="pt" style="font-size: 9pt">a</p>
      <p id="rem" style="font-size: 0.75rem">a</p>
      <div style="font-size: 20px"><p id="em" style="font-size: 0.5em">a</p><p id="pct" style="font-size: 50%">a</p><p id="inherit">a</p></div>
      <small id="small">a</small>
      <p id="none">a</p>
    </body>`,
  );
  const px = (id: string) =>
    createInlineStyleOracle().fontSizePx(doc.getElementById(id) as Element);

  it('reads inline font sizes in every unit', () => {
    expect(px('px')).toBe(11);
    expect(px('pt')).toBeCloseTo(12);
    expect(px('rem')).toBe(12);
    expect(px('em')).toBe(10);
    expect(px('pct')).toBe(10);
  });

  it('inherits from the parent and shrinks <small>', () => {
    expect(px('inherit')).toBe(20);
    expect(px('none')).toBe(16);
    expect(px('small')).toBeCloseTo(13);
  });

  it('honors a different root size', () => {
    expect(createInlineStyleOracle(20).fontSizePx(doc.getElementById('rem') as Element)).toBe(15);
  });

  it('wraps getComputedStyle without touching globals', () => {
    const calls: Element[] = [];
    const oracle = createComputedStyleOracle({
      getComputedStyle: (el) => {
        calls.push(el);
        return { fontSize: el.id === 'px' ? '11px' : '16px' };
      },
    });
    const el = doc.getElementById('px') as Element;
    expect(oracle.fontSizePx(el)).toBe(11);
    expect(oracle.fontSizePx(el)).toBe(11);
    expect(calls).toHaveLength(1); // cached
  });

  it('answers null when the browser cannot say', () => {
    const bad = createComputedStyleOracle({ getComputedStyle: () => ({ fontSize: '' }) });
    expect(bad.fontSizePx(doc.body)).toBeNull();
    const throws = createComputedStyleOracle({
      getComputedStyle: () => {
        throw new Error('detached');
      },
    });
    expect(throws.fontSizePx(doc.body)).toBeNull();
  });
});
