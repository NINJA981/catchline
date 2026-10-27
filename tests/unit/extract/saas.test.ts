// AC-F4.1: table-driven extractor cases for the saas family. Every sentence is hand-written for
// Catchline (see tests/fixtures/README.md, "Extractor table cases"); each row lists the chips a
// careful reader would expect, as "kind:label".
import { extractChips } from '../../../src/core';

const CASES: [text: string, chips: string[]][] = [
  [
    'Billed annually. $10 per user/mo if billed monthly. Minimum 3 seats. Prices exclude applicable taxes.',
    [
      'requirement:Billed annually',
      'requirement:Minimum 3 seats',
      'renewal:$10/mo if billed monthly',
    ],
  ],
  [
    'Unlimited projects with up to 10,000 API calls/month per workspace. Additional usage is billed at $5 per extra 1,000 API calls.',
    ['money:$5 per extra 1,000 API calls', 'exclusion:Up to 10,000 API calls/mo'],
  ],
  [
    'Priority support responds within 4 business hours on weekdays. Annual commitment required. No refunds for unused months.',
    ['requirement:Annual commitment', 'exclusion:No refunds'],
  ],
  [
    'Free for up to 5 users. After that $12 per user per month.',
    ['requirement:Priced per user', 'exclusion:Up to 5 users'],
  ],
  [
    'Storage limited to 100 GB per user. Overage billed at $0.10 per GB.',
    ['money:$0.10 per extra GB', 'exclusion:Up to 100 GB/user'],
  ],
  [
    'Price shown is per seat, billed annually. SSO available on Enterprise only.',
    ['requirement:Priced per seat', 'requirement:Billed annually'],
  ],
  [
    'Minimum 10 seats. Contracts are 12 months and auto-renew.',
    ['time:12-month contract', 'requirement:Minimum 10 seats', 'renewal:Auto-renews'],
  ],
  [
    'Free trial for 14 days. No credit card required. Converts to paid plan after the trial.',
    ['time:14 days'],
  ],
  ['Price per editor. Viewers are free. Guests limited to 50.', ['requirement:Priced per editor']],
  [
    'Promotional pricing of $8/user/mo for the first 3 months, then $15/user/mo.',
    ['time:First 3 months', 'requirement:Priced per user', 'renewal:Introductory price'],
  ],
  [
    'Rate limited to 100 requests per minute. Higher limits on request.',
    ['exclusion:Up to 100 requests/min'],
  ],
  ['Annual plans cannot be refunded after 30 days.', ['time:After 30 days']],
  ['Add-on AI assistant costs $10 per member per month.', ['requirement:Priced per member']],
  [
    'Up to 3 workspaces. Additional workspaces are $20/mo each.',
    ['money:$20/mo per extra workspace'],
  ],
  ['Plans renew at the then-current rate.', ['renewal:Renews at the regular price']],
];

describe('saas extractor', () => {
  it('has at least 15 table cases (AC-F4.1)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(CASES)('%s', (text, expected) => {
    const chips = extractChips(text, { family: 'saas' });
    expect(chips.map((c) => `${c.kind}:${c.label}`)).toEqual(expected);
  });

  it('every chip span points at text inside the sentence', () => {
    for (const [text] of CASES) {
      for (const chip of extractChips(text, { family: 'saas' })) {
        const [start, end] = chip.span;
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(text.length);
        expect(end).toBeGreaterThan(start);
      }
    }
  });
});
