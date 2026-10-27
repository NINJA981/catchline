// AC-F4.1: table-driven extractor cases for the retail family. Every sentence is hand-written for
// Catchline (see tests/fixtures/README.md, "Extractor table cases"); each row lists the chips a
// careful reader would expect, as "kind:label".
import { extractChips } from '../../../src/core';

const CASES: [text: string, chips: string[]][] = [
  [
    'Discount reflected in prices shown. Excludes clearance items and gift cards. Offer valid through Nov 30, 2026 at 11:59 P.M. ET.',
    ['time:Ends Nov 30, 2026', 'exclusion:Excludes clearance items and gift cards'],
  ],
  [
    'Free standard shipping on orders of $50+ after discounts. Contiguous US only.',
    ['requirement:Orders of $50+', 'exclusion:Contiguous US only'],
  ],
  [
    'Use code EXTRA20 at checkout. Limit one per customer. Not valid on select brands. Cannot be combined with other offers.',
    [
      'requirement:Code EXTRA20',
      'requirement:Limit one per customer',
      'exclusion:Select brands only',
      'exclusion:Not combinable with other offers',
    ],
  ],
  [
    'Members only. Sign-in required. In-store only for early access hours.',
    ['requirement:Members only', 'exclusion:In-store only'],
  ],
  ['While supplies last. Quantities limited.', ['exclusion:While supplies last']],
  [
    'Minimum purchase of $75 required. Excludes taxes and shipping.',
    ['requirement:Orders of $75+', 'exclusion:Taxes and fees extra'],
  ],
  [
    'Extra 15% off applies to sale prices. Excludes Apple, Nike and Dyson.',
    ['exclusion:Excludes Apple, Nike and Dyson'],
  ],
  ['Offer ends 12/01/2026. Online only.', ['time:Ends 12/01/2026', 'exclusion:Online only']],
  [
    '10% restocking fee on opened electronics. Return within 30 days.',
    ['money:10% restocking fee', 'time:30 days'],
  ],
  [
    'Prices may vary in store. Price match not available on doorbusters.',
    ['exclusion:Not available on doorbusters'],
  ],
  ['Discount capped at $50. One use per account.', ['exclusion:Discount capped at $50']],
  [
    'Free returns within 60 days. Excludes final sale items.',
    ['time:60 days', 'exclusion:Excludes final sale items'],
  ],
  [
    'Coupon code SAVE10 valid through December 15. Not valid on prior purchases.',
    ['time:Ends December 15', 'requirement:Code SAVE10', 'exclusion:Not valid on prior purchases'],
  ],
  ['Select styles only. Savings off original prices.', ['exclusion:Select styles only']],
  [
    'Free gift with purchase of $60 or more. While supplies last.',
    ['requirement:Orders of $60+', 'exclusion:While supplies last'],
  ],
  [
    'Cannot be used with other promotions or coupons.',
    ['exclusion:Not combinable with other offers'],
  ],
  [
    'Limit 2 per household. Delivery fee of $5.99 applies to orders under $35.',
    ['money:$5.99 delivery', 'requirement:Limit two per household'],
  ],
  ['Exclusions apply. See store for details.', ['exclusion:Exclusions apply']],
];

describe('retail extractor', () => {
  it('has at least 15 table cases (AC-F4.1)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(CASES)('%s', (text, expected) => {
    const chips = extractChips(text, { family: 'retail' });
    expect(chips.map((c) => `${c.kind}:${c.label}`)).toEqual(expected);
  });

  it('every chip span points at text inside the sentence', () => {
    for (const [text] of CASES) {
      for (const chip of extractChips(text, { family: 'retail' })) {
        const [start, end] = chip.span;
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(text.length);
        expect(end).toBeGreaterThan(start);
      }
    }
  });
});
