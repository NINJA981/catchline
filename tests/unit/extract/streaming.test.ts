// AC-F4.1: table-driven extractor cases for the streaming family. Every sentence is hand-written for
// Catchline (see tests/fixtures/README.md, "Extractor table cases"); each row lists the chips a
// careful reader would expect, as "kind:label".
import { extractChips } from '../../../src/core';

const CASES: [text: string, chips: string[]][] = [
  [
    'Basic with ads. Promotional price for 12 months, then $11.99/mo. New subscribers only.',
    [
      'time:12 months',
      'requirement:New subscribers only',
      'exclusion:With ads',
      'renewal:Introductory price',
      'renewal:Then $11.99/mo',
    ],
  ],
  [
    '30-day free trial for new subscribers only. After the trial ends, the plan renews at $15.49/mo unless you cancel.',
    [
      'time:30-day trial',
      'requirement:New subscribers only',
      'renewal:$15.49/mo after trial',
      'renewal:Charges until canceled',
    ],
  ],
  [
    'Stream on 4 devices at the same time within one household.',
    ['requirement:One household', 'exclusion:4 screens at a time'],
  ],
  [
    'Billed annually at $79.99. Price after the first year is $89.99.',
    ['time:After year 1', 'requirement:Billed annually', 'renewal:$89.99 after year 1'],
  ],
  [
    'Ad-supported plan includes some ads. Downloads not available with ads.',
    ['exclusion:With ads'],
  ],
  [
    '7-day free trial. Cancel anytime. Charges $9.99/mo after trial.',
    ['time:7-day trial', 'renewal:$9.99/mo after trial'],
  ],
  [
    'Limited to 2 screens at a time. 4K available on Premium only.',
    ['exclusion:2 screens at a time'],
  ],
  [
    'Annual plan is $119.88 billed upfront and renews automatically.',
    ['requirement:Billed annually', 'renewal:Auto-renews'],
  ],
  [
    'Live TV channels vary by location. Local channels not available in all areas.',
    ['exclusion:Not available everywhere'],
  ],
  [
    'Bundle price is $16.99/mo for the first 6 months, then $24.99/mo.',
    ['time:First 6 months', 'renewal:Then $24.99/mo'],
  ],
  [
    'Subscription auto-renews until canceled. Taxes may apply.',
    ['renewal:Auto-renews', 'renewal:Charges until canceled'],
  ],
  [
    'Free for 3 months, then $10.99 per month. Offer ends Jan 5.',
    ['time:3 months', 'time:Ends Jan 5', 'renewal:Then $10.99/mo'],
  ],
  ['Not available in all regions. Content library varies.', ['exclusion:Not available everywhere']],
  ['No refunds for partial months.', ['exclusion:No refunds']],
  [
    'Introductory price of $4.99/mo for 3 months, then regular price applies.',
    ['time:3 months', 'renewal:Introductory price', 'renewal:Regular price applies after'],
  ],
];

describe('streaming extractor', () => {
  it('has at least 15 table cases (AC-F4.1)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(CASES)('%s', (text, expected) => {
    const chips = extractChips(text, { family: 'streaming' });
    expect(chips.map((c) => `${c.kind}:${c.label}`)).toEqual(expected);
  });

  it('every chip span points at text inside the sentence', () => {
    for (const [text] of CASES) {
      for (const chip of extractChips(text, { family: 'streaming' })) {
        const [start, end] = chip.span;
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(text.length);
        expect(end).toBeGreaterThan(start);
      }
    }
  });
});
