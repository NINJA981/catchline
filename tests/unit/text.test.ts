import {
  collapseWhitespace,
  splitSentences,
  tokenize,
  tokenOverlap,
  truncate,
  wordCount,
} from '../../src/core';

describe('collapseWhitespace and wordCount', () => {
  it('collapses runs of whitespace, newlines and nbsp', () => {
    expect(collapseWhitespace('  a \n\t b  c  ')).toBe('a b c');
  });

  it('counts words, ignoring bare punctuation', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  ')).toBe(0);
    expect(wordCount('Terms apply — see details *')).toBe(4);
    expect(wordCount('$35 activation fee')).toBe(3);
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('cuts on a word boundary and adds a real ellipsis', () => {
    const out = truncate('alpha beta gamma delta epsilon', 20);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).toBe('alpha beta gamma…');
  });

  it('hard-cuts a single long word', () => {
    expect(truncate('x'.repeat(50), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('splitSentences', () => {
  const texts = (s: string) => splitSentences(s).map((x) => x.text);

  it('splits on terminators followed by a capital', () => {
    expect(texts('One fee. Two fees! Three?')).toEqual(['One fee.', 'Two fees!', 'Three?']);
  });

  it('does not split decimals, abbreviations or initialisms', () => {
    expect(texts('Pay $4.99 each. Contiguous U.S. only.')).toEqual([
      'Pay $4.99 each.',
      'Contiguous U.S. only.',
    ]);
    expect(texts('Approx. 5 GB per line, e.g. video. Next sentence.')).toEqual([
      'Approx. 5 GB per line, e.g. video.',
      'Next sentence.',
    ]);
  });

  it('splits after a unit abbreviation only when a capital follows', () => {
    expect(texts('$35/mo. Autopay required.')).toEqual(['$35/mo.', 'Autopay required.']);
    expect(texts('Billed at $10/mo. 36 payments follow.')).toHaveLength(1);
  });

  it('returns spans that index the original string', () => {
    const text = 'First one.  Second one.';
    for (const s of splitSentences(text)) expect(text.slice(s.start, s.end)).toBe(s.text);
  });

  it('keeps closing quotes with their sentence', () => {
    expect(texts('He said "stop." Then left.')).toEqual(['He said "stop."', 'Then left.']);
  });

  it('returns nothing for blank input', () => {
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('tokenize and tokenOverlap', () => {
  it('normalizes numbers, units and plurals', () => {
    const values = tokenize('$1,299.50 per month, 5 Lines and 50GB').map((t) => t.value);
    expect(values).toContain('1299.50');
    expect(values).toContain('month');
    expect(values).toContain('line');
    expect(values).toContain('50');
  });

  it('weights numbers and units double', () => {
    const t = tokenize('36 months of service');
    expect(t.find((x) => x.value === '36')?.weight).toBe(2);
    expect(t.find((x) => x.value === 'month')?.weight).toBe(2);
    expect(t.find((x) => x.value === 'service')?.weight).toBe(1);
  });

  it('drops stopwords and one-letter tokens', () => {
    expect(tokenize('a the of to I').map((t) => t.value)).toEqual([]);
  });

  it('measures the weighted share of the claim found in the candidate', () => {
    const claim = tokenize('$35 activation fee');
    expect(tokenOverlap(claim, tokenize('A $35 activation fee applies'))).toBe(1);
    expect(tokenOverlap(claim, tokenize('Nothing relevant here'))).toBe(0);
    const half = tokenOverlap(tokenize('activation fee'), tokenize('activation only'));
    expect(half).toBeCloseTo(0.5);
  });

  it('is zero for empty sides', () => {
    expect(tokenOverlap([], tokenize('anything'))).toBe(0);
    expect(tokenOverlap(tokenize('anything'), [])).toBe(0);
  });

  it('down-weights tokens by idf when given', () => {
    const claim = tokenize('autopay savings');
    const candidate = tokenize('autopay');
    const flat = tokenOverlap(claim, candidate);
    const idf = new Map([
      ['autopay', 5],
      ['savings', 1],
    ]);
    expect(tokenOverlap(claim, candidate, idf)).toBeGreaterThan(flat);
  });
});
