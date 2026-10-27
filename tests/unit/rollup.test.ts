import {
  badgeText,
  badgeTitle,
  buildRollup,
  formatMoney,
  isTabRollup,
  parseMoney,
  rollupSummary,
  type Catch,
  type Chip,
  type TabRollup,
} from '../../src/core';
import { periodSuffix } from '../../src/core/extract/money';
import { analyzeFixture } from './helpers';

let n = 0;
function chip(kind: Chip['kind'], label: string, value?: number, unit?: string): Chip {
  const c: Chip = { kind, label, span: [0, label.length] };
  if (value !== undefined) c.value = value;
  if (unit) c.unit = unit;
  return c;
}

function fakeCatch(chips: Chip[], counted = true): Catch {
  n++;
  return {
    marker: {
      id: `m${String(n)}`,
      glyph: '*',
      key: '*',
      claimText: 'claim',
      claimEl: new WeakRef(document.body),
      markerEl: null,
      anchor: null,
      family: 'unknown',
      ordinal: n,
    },
    match: {
      markerId: `m${String(n)}`,
      footnoteId: 'f',
      sentence: null,
      confidence: 0.9,
      signals: [],
    },
    chips,
    counted,
    reference: false,
  };
}

describe('money parsing and formatting', () => {
  it.each([
    ['$35', 35, 'USD', '$35'],
    ['$1,299.99', 1299.99, 'USD', '$1,299.99'],
    ['US$ 5', 5, 'USD', '$5'],
    ['€9,99', 9.99, 'EUR', '€9,99'],
    ['£4', 4, 'GBP', '£4'],
    ['$0', 0, 'USD', '$0'],
  ])('parses %s', (raw, value, currency, text) => {
    expect(parseMoney(raw)).toEqual({ value, currency, text });
  });

  it('returns null when there is no amount', () => {
    expect(parseMoney('free')).toBeNull();
    expect(parseMoney('$')).toBeNull();
  });

  it('formats whole amounts without decimals and others with two', () => {
    expect(formatMoney(35, 'USD')).toBe('$35');
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatMoney(9.99, 'EUR')).toBe('€9.99');
    expect(formatMoney(4, 'GBP')).toBe('£4');
  });

  it('maps period words to suffixes', () => {
    expect(periodSuffix('mo')).toBe('/mo');
    expect(periodSuffix('Monthly')).toBe('/mo');
    expect(periodSuffix('year')).toBe('/yr');
    expect(periodSuffix('week')).toBe('/wk');
    expect(periodSuffix('decade')).toBe('');
    expect(periodSuffix(undefined)).toBe('');
  });
});

describe('buildRollup', () => {
  it('sums one-time money, takes the longest term and lists requirements', () => {
    const r = buildRollup(
      7,
      [
        fakeCatch([
          chip('money', '$35 activation', 35, 'USD'),
          chip('time', '36-month agreement', 36, 'months'),
        ]),
        fakeCatch([
          chip('money', '$10 setup', 10, 'USD'),
          chip('time', 'After 6 months', 6, 'months'),
        ]),
        fakeCatch([chip('requirement', 'Autopay required')]),
      ],
      1234,
    );
    expect(r).toMatchObject({
      tabId: 7,
      catches: 3,
      listed: 3,
      scannedAt: 1234,
      money: { total: 45, currency: 'USD', items: ['$35 activation', '$10 setup'] },
      longestTerm: { months: 36, label: '36 months' },
      requirements: ['Autopay required'],
    });
  });

  it('counts a term shared by several claims once', () => {
    const shared = chip('money', '$35 activation', 35, 'USD');
    const r = buildRollup(1, [fakeCatch([shared]), fakeCatch([shared]), fakeCatch([shared])], 0);
    expect(r.money.total).toBe(35);
    expect(r.money.items).toEqual(['$35 activation']);
    expect(r.catches).toBe(3);
  });

  it('keeps recurring and per-unit amounts out of the hidden total', () => {
    const r = buildRollup(
      1,
      [
        fakeCatch([
          chip('money', '$12 monthly maintenance fee', 12, 'USD/mo'),
          chip('money', '$95 annual fee after year 1', 95, 'USD/yr'),
          chip('money', '$5 per extra 1,000 API calls', 5, 'USD/unit'),
          chip('money', '$25 upgrade', 25, 'USD'),
        ]),
      ],
      0,
    );
    expect(r.money.total).toBe(25);
    expect(r.money.items).toHaveLength(4);
  });

  it('sums only the first currency it meets', () => {
    const r = buildRollup(
      1,
      [fakeCatch([chip('money', '€10 fee', 10, 'EUR'), chip('money', '$5 fee', 5, 'USD')])],
      0,
    );
    expect(r.money).toMatchObject({ total: 10, currency: 'EUR' });
  });

  it('rounds sums to cents', () => {
    const r = buildRollup(
      1,
      [fakeCatch([chip('money', '$0.10 a', 0.1, 'USD'), chip('money', '$0.20 b', 0.2, 'USD')])],
      0,
    );
    expect(r.money.total).toBe(0.3);
  });

  it('turns sub-month terms into days', () => {
    const r = buildRollup(1, [fakeCatch([chip('time', '14 days', 0.47, 'months')])], 0);
    expect(r.longestTerm?.label).toBe('14 days');
    const one = buildRollup(1, [fakeCatch([chip('time', '1 month', 1, 'months')])], 0);
    expect(one.longestTerm?.label).toBe('1 month');
  });

  it('counts only counted catches but lists them all', () => {
    const r = buildRollup(
      1,
      [fakeCatch([chip('money', '$35 activation', 35, 'USD')]), fakeCatch([], false)],
      0,
    );
    expect(r.catches).toBe(1);
    expect(r.listed).toBe(2);
  });

  it('is empty for no catches', () => {
    expect(buildRollup(1, [], 5)).toMatchObject({
      catches: 0,
      listed: 0,
      money: { total: 0, currency: 'USD', items: [] },
      longestTerm: null,
      requirements: [],
    });
  });
});

describe('badge and tooltip text (AC-F7.1)', () => {
  const roll = (catches: number): TabRollup => ({ ...buildRollup(1, [], 0), catches });

  it('is empty for no catches and a number otherwise', () => {
    expect(badgeText(null)).toBe('');
    expect(badgeText(roll(0))).toBe('');
    expect(badgeText(roll(3))).toBe('3');
    expect(badgeText(roll(1234))).toBe('1234');
  });

  it('fits Chrome 4-character limit', () => {
    expect(badgeText(roll(12345))).toBe('999+');
    expect(badgeText(roll(99999)).length).toBeLessThanOrEqual(4);
  });

  it('writes "N catches: $X + Y months hidden"', () => {
    const r = buildRollup(
      1,
      [
        fakeCatch([
          chip('money', '$35 activation', 35, 'USD'),
          chip('time', '36-month', 36, 'months'),
        ]),
        fakeCatch([]),
        fakeCatch([]),
      ],
      0,
    );
    expect(rollupSummary(r)).toBe('3 catches: $35 + 36 months hidden');
    expect(badgeTitle(r)).toBe('3 catches: $35 + 36 months hidden');
  });

  it('degrades gracefully without money or time', () => {
    const r = buildRollup(1, [fakeCatch([chip('requirement', 'Autopay required')])], 0);
    expect(rollupSummary(r)).toBe('1 catch');
    const timeOnly = buildRollup(1, [fakeCatch([chip('time', '12 months', 12, 'months')])], 0);
    expect(rollupSummary(timeOnly)).toBe('1 catch: 12 months hidden');
  });

  it('has no middle dots anywhere in the rollup copy', () => {
    const r = buildRollup(1, [fakeCatch([chip('money', '$5 fee', 5, 'USD')])], 0);
    expect(rollupSummary(r)).not.toContain('·');
  });

  it('says there are no catches, and titles the badge with the product name', () => {
    expect(rollupSummary(null)).toBe('No catches on this page');
    expect(rollupSummary(roll(0))).toBe('No catches on this page');
    expect(badgeTitle(null)).toBe('Catchline');
    expect(badgeTitle(roll(0))).toBe('Catchline');
  });
});

describe('isTabRollup', () => {
  const good = buildRollup(1, [], 0);

  it('accepts a real rollup', () => {
    expect(isTabRollup(good)).toBe(true);
    expect(isTabRollup(JSON.parse(JSON.stringify(good)))).toBe(true);
  });

  it.each([
    null,
    undefined,
    5,
    'x',
    [],
    {},
    { ...good, tabId: '1' },
    { ...good, money: null },
    { ...good, requirements: 'a' },
    { ...good, money: { total: 1 } },
  ])('rejects %j', (bad) => {
    expect(isTabRollup(bad)).toBe(false);
  });
});

describe('rollups for the synthetic specimens', () => {
  const summary = (name: string) => {
    const a = analyzeFixture(`synthetic/${name}.html`);
    return rollupSummary(buildRollup(1, a.catches, 0));
  };

  it('carrier specimen reads "3 catches: $35 + 36 months hidden" (SPEC §12)', () => {
    expect(summary('carrier-specimen')).toBe('3 catches: $35 + 36 months hidden');
  });

  it('reference-only pages roll up to nothing (AC-F7.2)', () => {
    const a = analyzeFixture('synthetic/reference-footnotes.html');
    const r = buildRollup(1, a.catches, 0);
    expect(r.catches).toBe(0);
    expect(r.listed).toBeGreaterThan(0);
    expect(badgeText(r)).toBe('');
  });

  it('pages with no markers roll up to nothing', () => {
    expect(summary('cents')).toBe('No catches on this page');
    expect(summary('math-code')).toBe('No catches on this page');
  });

  it('counts every other family page', () => {
    for (const name of ['bank', 'retail', 'streaming', 'saas', 'travel']) {
      const a = analyzeFixture(`synthetic/${name}-specimen.html`);
      expect(buildRollup(1, a.catches, 0).catches, name).toBeGreaterThanOrEqual(3);
    }
  });
});
