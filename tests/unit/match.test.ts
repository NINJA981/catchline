import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  analyze,
  confidenceLevel,
  createInlineStyleOracle,
  MATCH_THRESHOLD,
  scoreCandidate,
  type Catch,
} from '../../src/core';
import { analyzeFixture, analyzeHtml, byClaim, FIXTURES, parse, shownText } from './helpers';

describe('F2 stage A: linked footnotes (AC-F2.1)', () => {
  const a = analyzeFixture('synthetic/linked.html');

  it('matches href="#id" at confidence 1.0 with signal href', () => {
    const c = byClaim(a, '$45/mo');
    expect(c.match.confidence).toBe(1);
    expect(c.match.signals).toEqual(['href']);
    expect(shownText(a, c)).toContain('12-month term');
  });

  it('matches aria-describedby and aria-details', () => {
    expect(byClaim(a, 'Price lock').match.signals).toEqual(['aria-describedby']);
    expect(byClaim(a, 'No data caps').match.signals).toEqual(['aria-details']);
    expect(byClaim(a, 'Price lock').match.confidence).toBe(1);
  });

  it('never points a link at the block that holds the marker', () => {
    const doc = parse(
      '<body><p id="c">Claim<sup><a href="#c">1</a></sup></p><p>1. Real note about $5 fee.</p></body>',
    );
    const [c] = analyze(doc, createInlineStyleOracle()).catches;
    expect(c?.match.signals).not.toContain('href');
  });
});

describe('F2 stage B: unlinked footnotes (AC-F2.2)', () => {
  it('matches a glyph-prefixed block in a legal container at confidence >= 0.7', () => {
    const a = analyzeFixture('synthetic/carrier-specimen.html');
    for (const c of a.catches) {
      expect(c.match.confidence).toBeGreaterThanOrEqual(0.7);
      expect(c.match.signals).toContain('same-glyph-block-start');
      expect(c.match.signals).toContain('legal-container');
    }
  });

  it.each([
    ['footer', '<footer>'],
    ['[class*=legal]', '<div class="page-legal">'],
    ['[class*=disclaimer]', '<div class="disclaimer-block">'],
    ['[id*=terms]', '<div id="site-terms">'],
  ])('finds the footnote inside %s', (_name, open) => {
    const close = open.startsWith('<footer') ? '</footer>' : '</div>';
    const a = analyzeHtml(
      `<body><p>Free installation†</p>${open}<p>† Requires a 12-month term. $99 setup fee.</p>${close}</body>`,
    );
    const c = a.catches[0];
    expect(c?.match.footnoteId).not.toBeNull();
    expect(c?.match.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('matches a small-font block outside any legal container', () => {
    const a = analyzeHtml(
      '<body style="font-size:16px"><p>Free installation†</p><p style="font-size:11px">† Requires a 12-month term.</p></body>',
    );
    const c = a.catches[0];
    expect(c?.match.signals).toContain('small-font');
    expect(c?.match.footnoteId).not.toBeNull();
  });

  it('prefers the glyph block nearest below the claim among several', () => {
    const a = analyzeFixture('synthetic/plan-cards.html');
    expect(a.catches).toHaveLength(3);
    expect(shownText(a, byClaim(a, '$30/mo'))).toContain('4 lines');
    expect(shownText(a, byClaim(a, '$45/mo'))).toContain('3 lines');
    expect(shownText(a, byClaim(a, '$60/mo'))).toContain('Single line');
  });

  it('splits several footnotes written on one line', () => {
    const a = analyzeHtml(
      '<body><p>Fast speeds*</p><p>Free setup†</p><footer>* Wired maximum speeds. † $99 fee waived with autopay.</footer></body>',
    );
    expect(shownText(a, byClaim(a, 'Fast'))).toBe('Wired maximum speeds.');
    expect(shownText(a, byClaim(a, 'Free setup'))).toContain('$99 fee waived');
  });

  it('numbers an ordered list of footnotes by position', () => {
    const a = analyzeHtml(
      '<body><p>Claim one<sup>1</sup> and claim two<sup>2</sup></p><footer><ol><li>Costs $5 a month.</li><li>Ends Dec 1, 2026.</li></ol></footer></body>',
    );
    expect(shownText(a, byClaim(a, 'Claim one'))).toBe('Costs $5 a month.');
    expect(a.catches.map((c) => c.marker.key)).toEqual(['1', '2']);
    const second = a.catches[1];
    expect(second && shownText(a, second)).toBe('Ends Dec 1, 2026.');
  });
});

describe('F2 hidden text (AC-F2.3)', () => {
  const a = analyzeFixture('synthetic/hidden.html');

  it('matches footnotes inside a closed <details> and an aria-hidden panel', () => {
    const bonus = byClaim(a, '$400 bonus');
    const fee = byClaim(a, 'No monthly fee');
    expect(bonus.match.footnoteId).not.toBeNull();
    expect(fee.match.footnoteId).not.toBeNull();
    expect(bonus.match.signals).toContain('hidden-text');
    expect(fee.match.signals).toContain('hidden-text');
    expect(bonus.match.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('extracts chips from the hidden text', () => {
    const labels = byClaim(a, '$400 bonus').chips.map((c) => c.label);
    expect(labels).toContain('Direct deposits of $5,000+');
    expect(labels).toContain('New customers only');
  });
});

describe('F2 not found (AC-F2.4)', () => {
  const a = analyzeFixture('synthetic/not-found.html');

  it('yields footnoteId null, never a guessed match', () => {
    expect(a.catches).toHaveLength(3);
    for (const c of a.catches) {
      expect(c.match.footnoteId).toBeNull();
      expect(c.match.sentence).toBeNull();
      expect(c.chips).toEqual([]);
      expect(c.counted).toBe(false);
    }
  });

  it('does not match a footnote with the wrong glyph', () => {
    const b = analyzeHtml('<body><p>Price*</p><footer>† Requires a 12-month term.</footer></body>');
    expect(b.catches[0]?.match.footnoteId).toBeNull();
    expect(b.catches[0]?.match.signals).toContain('no-candidate');
  });

  it('reports a terms link as "Terms are on another page"', () => {
    const c = byClaim(a, 'Two months free');
    expect(c.match.external).toEqual({
      href: 'https://tidewell.example/legal/offer-details',
      host: 'tidewell.example',
    });
    expect(byClaim(a, '$12.99').match.external).toBeUndefined();
  });

  it('keeps a below-threshold best candidate out of the result', () => {
    const b = analyzeHtml(
      '<body><p>Alpha*</p><p>Beta*</p><p>Gamma*</p><p>Delta*</p><p>Epsilon*</p><p style="font-size:30px">* Large type note about nothing.</p></body>',
    );
    for (const c of b.catches) {
      if (c.match.confidence < MATCH_THRESHOLD) expect(c.match.footnoteId).toBeNull();
    }
  });
});

describe('F2 lazy legal drawer (AC-F2.5)', () => {
  it('matches once the footnote is inserted and the page is analyzed again', () => {
    const doc = parse('<body><p>Free shipping†</p><footer id="legal"></footer></body>');
    const before = analyze(doc, createInlineStyleOracle());
    expect(before.catches[0]?.match.footnoteId).toBeNull();

    const p = doc.createElement('p');
    p.textContent = '† Orders over $50 only. Contiguous US.';
    doc.getElementById('legal')?.appendChild(p);

    const after = analyze(doc, createInlineStyleOracle());
    expect(after.catches[0]?.match.footnoteId).not.toBeNull();
    // The marker id is stable across scans, so the overlay can keep its selection.
    expect(after.catches[0]?.marker.id).toBe(before.catches[0]?.marker.id);
  });
});

describe('F3 many-to-one (AC-F3.1)', () => {
  const a = analyzeFixture('synthetic/many-to-one.html');
  const labels = JSON.parse(
    readFileSync(join(FIXTURES, 'synthetic', 'many-to-one.expected.json'), 'utf8'),
  ) as { wordCount: number; claims: { claim: string; sentenceStartsWith: string }[] };

  it('has 14 claims on one 612-word footnote', () => {
    expect(labels.claims).toHaveLength(14);
    expect(a.catches).toHaveLength(14);
    const footnoteIds = new Set(a.catches.map((c) => c.match.footnoteId));
    expect(footnoteIds.size).toBe(1);
    const only = [...a.footnotes.values()][0];
    expect(only?.block.wordCount).toBe(labels.wordCount);
  });

  it('assigns every claim a sentence span, at least 12 of 14 equal to the hand label', () => {
    let correct = 0;
    for (const label of labels.claims) {
      const c = a.catches.find((x) => x.marker.claimText.startsWith(label.claim));
      expect(c, label.claim).toBeDefined();
      expect(c?.match.sentence, label.claim).not.toBeNull();
      const text = c ? shownText(a, c) : null;
      if (text?.startsWith(label.sentenceStartsWith)) correct++;
    }
    expect(correct).toBeGreaterThanOrEqual(12);
  });

  it('tags the match with the many-to-one signal', () => {
    for (const c of a.catches) expect(c.match.signals).toContain('many-to-one:14');
  });
});

describe('phrase markers', () => {
  it('match the nearest legal section and show it whole when no sentence fits', () => {
    const a = analyzeHtml(
      '<body><p>Save big this weekend. Terms apply.</p><footer class="legal"><p>Offer valid for new customers with a 24-month agreement. $35 activation fee.</p></footer></body>',
    );
    const c = a.catches[0];
    expect(c?.marker.glyph).toBe('phrase');
    expect(c?.match.signals).toContain('phrase-legal-section');
    expect(c?.chips.map((x) => x.label)).toContain('$35 activation');
  });

  it('are not paired with a sentence on a single shared word', () => {
    const a = analyzeFixture('synthetic/glyphs.html');
    const phrases = a.catches.filter((c) => c.marker.glyph === 'phrase');
    expect(phrases).toHaveLength(5);
    for (const c of phrases) {
      const text = shownText(a, c);
      // Either the whole section or a sentence sharing at least two words with the claim.
      expect(text).not.toBe('³ Streaming bundle for new customers only.');
    }
  });
});

describe('reference footnotes (AC-F7.2)', () => {
  const a = analyzeFixture('synthetic/reference-footnotes.html');

  it('lists Wikipedia-style references but never counts them', () => {
    expect(a.catches.length).toBeGreaterThan(0);
    expect(a.catches.every((c) => c.reference)).toBe(true);
    expect(a.catches.every((c) => !c.counted)).toBe(true);
  });
});

describe('confidence model', () => {
  const base = {
    sameKey: true,
    phraseSection: false,
    inLegal: true,
    smallFont: true,
    hidden: false,
    belowClaim: true,
    nearestFollowing: true,
    candidates: 1,
    overlap: 0,
  };

  it('caps heuristic matches below 1.0, which is reserved for links', () => {
    const { confidence } = scoreCandidate({ ...base, overlap: 1 });
    expect(confidence).toBeLessThan(1);
    expect(confidence).toBeLessThanOrEqual(0.99);
  });

  it('rewards the same glyph at block start more than anything else', () => {
    const withKey = scoreCandidate({ ...base, inLegal: false, smallFont: false }).confidence;
    const without = scoreCandidate({
      ...base,
      sameKey: false,
      inLegal: false,
      smallFont: false,
    }).confidence;
    expect(withKey - without).toBeCloseTo(0.45);
  });

  it('penalizes crowded candidate lists up to a cap', () => {
    const two = scoreCandidate({ ...base, candidates: 2 }).confidence;
    const nine = scoreCandidate({ ...base, candidates: 9 }).confidence;
    const nineteen = scoreCandidate({ ...base, candidates: 19 }).confidence;
    expect(two).toBeLessThan(scoreCandidate(base).confidence);
    expect(nine).toBeLessThan(two);
    expect(nineteen).toBe(nine);
  });

  it('labels confidence for the card', () => {
    expect(confidenceLevel(1, true)).toBe('matched');
    expect(confidenceLevel(0.8, true)).toBe('matched');
    expect(confidenceLevel(0.7, true)).toBe('likely');
    expect(confidenceLevel(0.44, true)).toBe('not-found');
    expect(confidenceLevel(0.99, false)).toBe('not-found');
  });
});

describe('analysis invariants over every synthetic fixture', () => {
  const names = [
    'carrier-specimen',
    'bank-specimen',
    'retail-specimen',
    'streaming-specimen',
    'saas-specimen',
    'travel-specimen',
    'glyphs',
    'linked',
    'hidden',
    'plan-cards',
    'many-to-one',
    'not-found',
    'reference-footnotes',
  ];

  it.each(names)('%s: confidence is 0..1 and spans stay inside the footnote', (name) => {
    const a = analyzeFixture(`synthetic/${name}.html`);
    for (const c of a.catches) {
      expect(c.match.confidence).toBeGreaterThanOrEqual(0);
      expect(c.match.confidence).toBeLessThanOrEqual(1);
      if (c.match.footnoteId === null) continue;
      const fn = a.footnotes.get(c.match.footnoteId);
      expect(fn).toBeDefined();
      if (c.match.sentence && fn) {
        expect(c.match.sentence.start).toBeGreaterThanOrEqual(0);
        expect(c.match.sentence.end).toBeLessThanOrEqual(fn.block.text.length);
        expect(c.match.sentence.end).toBeGreaterThan(c.match.sentence.start);
      }
      for (const chip of c.chips) {
        const text = fn?.block.text ?? '';
        expect(chip.span[1]).toBeLessThanOrEqual(text.length);
      }
    }
  });

  it('is deterministic: two analyses of the same page agree', () => {
    const summarize = (cs: Catch[]) =>
      cs.map((c) => [c.marker.id, c.match.footnoteId, c.match.confidence, c.chips.length]);
    const one = analyzeFixture('synthetic/carrier-specimen.html');
    const two = analyzeFixture('synthetic/carrier-specimen.html');
    expect(summarize(one.catches)).toEqual(summarize(two.catches));
  });
});
