import { CHIP_KINDS, extractChips, RULES } from '../../../src/core';

const labels = (text: string, family?: Parameters<typeof extractChips>[1]) =>
  extractChips(text, family).map((c) => `${c.kind}:${c.label}`);

describe('extractor behavior (F4)', () => {
  it('turns "$35 activation" into a money chip with a value and a span', () => {
    const text = 'A $35 activation fee applies.';
    const [chip] = extractChips(text);
    expect(chip).toMatchObject({ kind: 'money', label: '$35 activation', value: 35, unit: 'USD' });
    expect(text.slice(...(chip?.span ?? [0, 0]))).toBe('$35 activation fee');
  });

  it('reads each of the six chip kinds', () => {
    const text =
      '$35 activation fee. 36-month agreement. 0% intro APR for 15 months, then 19.24%-29.99% variable APR. ' +
      'Autopay required. Excludes clearance items. Renews at $17.99/mo.';
    const kinds = new Set(extractChips(text).map((c) => c.kind));
    expect([...kinds].sort()).toEqual([...CHIP_KINDS].sort());
  });

  it('covers the acceptance examples (AC-F4.1)', () => {
    expect(labels('$35 activation')).toContain('money:$35 activation');
    expect(labels('36-month contract')).toContain('time:36-month contract');
    expect(
      labels('0% intro APR for 15 months, then 19.24%-29.99% variable APR.', { family: 'bank' }),
    ).toEqual(['time:15 months', 'rate:0% intro APR', 'rate:19.24%-29.99% variable APR']);
    expect(labels('autopay required')).toContain('requirement:Autopay required');
    expect(labels('excludes clearance items.')).toContain('exclusion:Excludes clearance items');
    expect(labels('renews at $17.99/mo')).toContain('renewal:Renews at $17.99/mo');
  });

  it('stores structured values for the rollup', () => {
    const chips = extractChips('Early termination fee of $150. 24-month agreement.');
    expect(chips.find((c) => c.kind === 'money')).toMatchObject({ value: 150, unit: 'USD' });
    expect(chips.find((c) => c.kind === 'time')).toMatchObject({ value: 24, unit: 'months' });
    const renew = extractChips('Renews at $17.99/mo').find((c) => c.kind === 'renewal');
    expect(renew).toMatchObject({ value: 17.99, unit: 'USD/mo' });
  });

  it('converts years and days to months', () => {
    expect(extractChips('3-year price lock').find((c) => c.kind === 'time')?.value).toBe(36);
    expect(extractChips('within 90 days').find((c) => c.kind === 'time')?.value).toBe(3);
  });

  it('returns nothing for text with no terms', () => {
    for (const text of [
      '',
      '   ',
      'Thank you for being a customer.',
      'Photos are for illustration only.',
      'Please read our privacy policy.',
    ]) {
      expect(extractChips(text)).toEqual([]);
    }
  });

  it('is deterministic and ignores regex state between calls', () => {
    const text = 'With 36-month agreement and autopay. $10 activation fee.';
    const first = extractChips(text);
    for (let i = 0; i < 5; i++) expect(extractChips(text)).toEqual(first);
  });

  it('dedupes a repeated term', () => {
    const chips = extractChips('$35 activation fee. Again, the $35 activation fee applies.');
    expect(chips.filter((c) => c.label === '$35 activation')).toHaveLength(1);
  });

  it('orders chips by kind, then by position in the text', () => {
    const chips = extractChips('Autopay required. 36-month agreement. $35 activation fee.');
    expect(chips.map((c) => c.kind)).toEqual(['money', 'time', 'requirement']);
    const money = extractChips('$5 setup fee, then a $10 equipment fee').filter(
      (c) => c.kind === 'money',
    );
    expect(money[0]?.span[0]).toBeLessThan(money[1]?.span[0] ?? 0);
  });

  it('does not let two chips cover the same words', () => {
    const chips = extractChips(
      'Early termination fee of $150 applies if you cancel within 24 months.',
    );
    for (const a of chips) {
      for (const b of chips) {
        if (a === b || a.kind !== b.kind) continue;
        expect(a.span[0] < b.span[1] && b.span[0] < a.span[1], `${a.label} / ${b.label}`).toBe(
          false,
        );
      }
    }
  });

  it('shifts spans by the offset of a sentence cut from a longer text', () => {
    const full = 'Intro sentence here. $35 activation fee.';
    const sentence = '$35 activation fee.';
    const offset = full.indexOf(sentence);
    const [chip] = extractChips(sentence, { offset });
    expect(full.slice(...(chip?.span ?? [0, 0]))).toBe('$35 activation fee');
  });

  it('lets the page family win an overlap', () => {
    const text = 'Annual fee: $0 for the first 12 months, then $250.';
    expect(labels(text, { family: 'bank' })).toContain('money:$250 annual fee after year 1');
  });

  it('is case-insensitive and tolerant of odd whitespace', () => {
    expect(labels('AUTOPAY   REQUIRED')).toEqual(labels('autopay required'));
    expect(labels('$35 activation fee')).toEqual(labels('$35 activation fee'));
  });

  it('handles euros and pounds', () => {
    expect(extractChips('€15 activation fee').find((c) => c.kind === 'money')).toMatchObject({
      value: 15,
      unit: 'EUR',
    });
    expect(extractChips('£4 delivery fee').find((c) => c.kind === 'money')).toMatchObject({
      value: 4,
      unit: 'GBP',
    });
  });

  it('skips "taxes and fees" as a fee amount but flags them as extra', () => {
    expect(labels('Excludes taxes and fees.')).toEqual(['exclusion:Taxes and fees extra']);
  });

  it('never runs long on pathological input', () => {
    const nasty = `${'$'.repeat(2000)} ${'1,'.repeat(2000)} ${'fee '.repeat(2000)}`;
    const t0 = performance.now();
    extractChips(nasty);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('rule table', () => {
  it('has unique ids, global regexes and a known kind for every rule', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) {
      expect(r.re.flags, r.id).toContain('g');
      expect(CHIP_KINDS, r.id).toContain(r.kind);
    }
  });

  it('has rules for every family', () => {
    const families = new Set(RULES.map((r) => r.family).filter(Boolean));
    expect([...families].sort()).toEqual([
      'bank',
      'carrier',
      'retail',
      'saas',
      'streaming',
      'travel',
    ]);
  });

  it('never matches the empty string (a zero-width match would loop)', () => {
    for (const r of RULES) {
      r.re.lastIndex = 0;
      expect(r.re.exec(''), r.id).toBeNull();
    }
  });
});
