// AC-F4.1: table-driven extractor cases for the travel family. Every sentence is hand-written for
// Catchline (see tests/fixtures/README.md, "Extractor table cases"); each row lists the chips a
// careful reader would expect, as "kind:label".
import { extractChips } from '../../../src/core';

const CASES: [text: string, chips: string[]][] = [
  [
    'Fare is each way, based on round-trip purchase. Excludes government taxes and fees of up to $5.60 per flight. Checked bags extra. Non-refundable. Blackout dates apply. Select routes only.',
    [
      'requirement:One-way fare',
      'requirement:Round trip required',
      'exclusion:Taxes and fees extra',
      'exclusion:Bag fees extra',
      'exclusion:Non-refundable',
      'exclusion:Blackout dates apply',
      'exclusion:Select routes only',
    ],
  ],
  [
    'Round-trip Basic Economy fare. No changes or cancellations. First checked bag $35.',
    ['money:$35 bag fee', 'exclusion:Basic economy', 'exclusion:No changes allowed'],
  ],
  [
    'Per night, per person based on double occupancy. A $35/night resort fee is not included. Minimum 2-night stay.',
    [
      'money:$35/night resort fee',
      'requirement:Per person, double occupancy',
      'requirement:Minimum 2 nights',
    ],
  ],
  [
    'Book at least 14 days in advance. Fares are one-way and include taxes.',
    ['requirement:Book 14 days ahead', 'requirement:One-way fare'],
  ],
  ['Carry-on bag fee of $45 applies. Seat selection costs extra.', ['money:$45 bag fee']],
  [
    'Rates from $129 per night. Taxes and fees extra. Cancellation penalties apply.',
    ['exclusion:Taxes and fees extra'],
  ],
  [
    'Based on availability. Valid for travel Jan 10 - Mar 31. Blackout dates apply.',
    ['exclusion:Blackout dates apply'],
  ],
  [
    'Cruise fares are per person, based on double occupancy.',
    ['requirement:Per person, double occupancy'],
  ],
  [
    'Fares shown are for travel on select weekdays. Round trip purchase required.',
    ['requirement:Round trip required'],
  ],
  [
    'Non-refundable. Changes allowed for a $99 fee plus any fare difference.',
    ['money:$99 fee', 'exclusion:Non-refundable'],
  ],
  [
    'Destination fee of $30 per night is payable at the hotel.',
    ['money:$30/night destination fee'],
  ],
  [
    'Fare includes one personal item. Carry-on and checked bags are extra.',
    ['exclusion:Bag fees extra'],
  ],
  [
    'Package price is per person, based on 2 travelers. Flights are not included.',
    ['requirement:Price per person'],
  ],
  ['One-way fares from $59. Subject to availability.', ['requirement:One-way fare']],
  [
    'Hotel stay must be at least 3 nights. Free cancellation until 48 hours before check-in.',
    ['requirement:Minimum 3 nights'],
  ],
];

describe('travel extractor', () => {
  it('has at least 15 table cases (AC-F4.1)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(CASES)('%s', (text, expected) => {
    const chips = extractChips(text, { family: 'travel' });
    expect(chips.map((c) => `${c.kind}:${c.label}`)).toEqual(expected);
  });

  it('every chip span points at text inside the sentence', () => {
    for (const [text] of CASES) {
      for (const chip of extractChips(text, { family: 'travel' })) {
        const [start, end] = chip.span;
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(text.length);
        expect(end).toBeGreaterThan(start);
      }
    }
  });
});
