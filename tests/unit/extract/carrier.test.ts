// AC-F4.1: table-driven extractor cases for the carrier family. Every sentence is hand-written for
// Catchline (see tests/fixtures/README.md, "Extractor table cases"); each row lists the chips a
// careful reader would expect, as "kind:label".
import { extractChips } from '../../../src/core';

const CASES: [text: string, chips: string[]][] = [
  [
    'With 36-month installment agreement. $35 activation fee. Autopay required.',
    ['money:$35 activation', 'time:36-month installment agreement', 'requirement:Autopay required'],
  ],
  [
    '$200 off via 24 monthly bill credits; requires new line and port-in from another carrier.',
    [
      'time:Credits over 24 months',
      'requirement:New line required',
      'requirement:Port-in required',
    ],
  ],
  [
    'Customers may notice slower speeds than other customers after 50GB of data per month.',
    ['exclusion:Slower after 50 GB'],
  ],
  [
    'Video streams at 480p. Mobile hotspot limited to 15GB, then 3G speeds.',
    ['exclusion:Video at 480p', 'exclusion:Hotspot capped at 15 GB'],
  ],
  [
    'Price is $45/mo with autopay and paperless billing; $55/mo without.',
    ['requirement:Autopay and paperless billing required'],
  ],
  ['Requires trade-in of an eligible device in good condition.', ['requirement:Trade-in required']],
  ['Price lock guarantee applies for 3 years on the base plan price.', ['time:3 years']],
  [
    'Early termination fee of $150 applies if you cancel within 24 months.',
    ['money:$150 early termination fee', 'time:24 months'],
  ],
  [
    'Taxes and fees extra. Deprioritized after 100 GB per line.',
    ['exclusion:Taxes and fees extra', 'exclusion:Slower after 100 GB'],
  ],
  [
    'Limited time offer. Ends Nov 30, 2026. New customers only.',
    ['time:Ends Nov 30, 2026', 'requirement:New customers only'],
  ],
  [
    'Fiber speeds are wired maximums. $99 installation fee. Requires autopay.',
    ['money:$99 installation', 'requirement:Autopay required'],
  ],
  [
    'Offer available in select markets only. $0 due today with credit approval.',
    ['money:$0 due today', 'requirement:Credit approval', 'exclusion:Select markets only'],
  ],
  [
    'Prepaid plan: $25/mo, price after 12 months is $30/mo.',
    ['time:After 12 months', 'renewal:$30/mo after 12 months'],
  ],
  [
    'International calling to 30 countries; excludes satellite and premium numbers.',
    ['exclusion:Excludes satellite and premium numbers'],
  ],
  [
    'Requires 5G Unlimited Plus plan. Not available on prepaid.',
    ['exclusion:Not available on prepaid'],
  ],
  ['You must be a new customer and activate within 30 days.', ['time:30 days']],
];

describe('carrier extractor', () => {
  it('has at least 15 table cases (AC-F4.1)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(CASES)('%s', (text, expected) => {
    const chips = extractChips(text, { family: 'carrier' });
    expect(chips.map((c) => `${c.kind}:${c.label}`)).toEqual(expected);
  });

  it('every chip span points at text inside the sentence', () => {
    for (const [text] of CASES) {
      for (const chip of extractChips(text, { family: 'carrier' })) {
        const [start, end] = chip.span;
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(text.length);
        expect(end).toBeGreaterThan(start);
      }
    }
  });
});
