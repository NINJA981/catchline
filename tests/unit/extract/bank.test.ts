// AC-F4.1: table-driven extractor cases for the bank family. Every sentence is hand-written for
// Catchline (see tests/fixtures/README.md, "Extractor table cases"); each row lists the chips a
// careful reader would expect, as "kind:label".
import { extractChips } from '../../../src/core';

const CASES: [text: string, chips: string[]][] = [
  [
    '0% intro APR on purchases and balance transfers for 15 months from account opening, then a 19.24%-29.99% variable APR. Balance transfer fee of 3% (minimum $5). Transfer within 120 days.',
    [
      'time:15 months',
      'time:120 days',
      'rate:0% intro APR',
      'rate:19.24%-29.99% variable APR',
      'rate:3% balance transfer fee',
    ],
  ],
  [
    'Earn a $300 bonus after you spend $3,000 on purchases in the first 3 months from account opening.',
    ['time:First 3 months', 'requirement:Spend $3,000 in 3 months'],
  ],
  [
    '$0 intro annual fee for the first year, then $95.',
    ['money:$95 annual fee after year 1', 'time:First year'],
  ],
  [
    'New customers only. Receive qualifying direct deposits totaling $5,000 or more within 90 days.',
    ['time:90 days', 'requirement:New customers only', 'requirement:Direct deposits of $5,000+'],
  ],
  [
    'A $12 monthly maintenance fee applies unless you keep a $1,500 minimum daily balance.',
    ['money:$12 monthly maintenance fee', 'requirement:Keep a $1,500 balance'],
  ],
  [
    '5% foreign transaction fee on purchases made outside the U.S.',
    ['rate:5% foreign transaction fee'],
  ],
  [
    'Cash back does not apply to balance transfers or cash advances.',
    ['exclusion:Does not apply to balance transfers or cash advances'],
  ],
  [
    'APY is 4.35% as of 10/20/2026. Rates are variable and may change after account opening.',
    ['rate:4.35% APY'],
  ],
  ['Subject to credit approval. Must be 18 or older.', ['requirement:Credit approval']],
  [
    'Must keep account open for 90 days or bonus may be forfeited.',
    ['time:90 days', 'requirement:Keep account open 90 days'],
  ],
  ['Overdraft fee of $35 per item. Maximum of 3 fees per day.', ['money:$35 overdraft fee']],
  [
    'Earn 60,000 bonus points after spending $4,000 in the first 3 months.',
    ['time:First 3 months', 'requirement:Spend $4,000 in 3 months'],
  ],
  ['Variable APR 21.49% to 28.49% based on creditworthiness.', ['rate:21.49%-28.49% APR']],
  [
    'Annual fee: $0 for the first 12 months, then $250.',
    ['money:$250 annual fee after year 1', 'time:First 12 months'],
  ],
  ['Offer expires December 31, 2026. One bonus per customer.', ['time:Expires December 31, 2026']],
];

describe('bank extractor', () => {
  it('has at least 15 table cases (AC-F4.1)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(CASES)('%s', (text, expected) => {
    const chips = extractChips(text, { family: 'bank' });
    expect(chips.map((c) => `${c.kind}:${c.label}`)).toEqual(expected);
  });

  it('every chip span points at text inside the sentence', () => {
    for (const [text] of CASES) {
      for (const chip of extractChips(text, { family: 'bank' })) {
        const [start, end] = chip.span;
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(text.length);
        expect(end).toBeGreaterThan(start);
      }
    }
  });
});
