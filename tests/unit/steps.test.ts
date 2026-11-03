// Time-sliced scanning (fix round 1, perf): the sliced scan returns exactly what the one-shot scan
// does, hands the thread back between slices, and pages over the node cap scan only their
// main, footer and legal containers.
import {
  analyze,
  analyzeSliced,
  createInlineStyleOracle,
  drain,
  runSliced,
  scanScopes,
} from '../../src/core';
import { loadFixture, parse } from './helpers';

describe('runSliced', () => {
  function* counter(n: number): Generator<void, number> {
    for (let i = 0; i < n; i++) yield;
    return n;
  }

  it('returns the generator result and yields to the main thread once the slice is spent', async () => {
    let clock = 0;
    let yields = 0;
    const result = await runSliced(counter(100), {
      sliceMs: 8,
      now: () => (clock += 1), // every step "costs" 1 ms
      yieldToMain: () => {
        yields++;
        return Promise.resolve();
      },
    });
    expect(result).toBe(100);
    expect(yields).toBeGreaterThan(5);
  });

  it('never yields when the work fits in one slice', async () => {
    let yields = 0;
    await runSliced(counter(10), {
      now: () => 0,
      yieldToMain: () => {
        yields++;
        return Promise.resolve();
      },
    });
    expect(yields).toBe(0);
  });

  it('drain runs to the end at once', () => {
    expect(drain(counter(5))).toBe(5);
  });
});

describe('analyzeSliced', () => {
  it.each(['carrier-specimen.html', 'many-to-one.html', 'bank-specimen.html'])(
    'matches the one-shot analysis of %s',
    async (name) => {
      const oracle = createInlineStyleOracle();
      const direct = analyze(loadFixture(`synthetic/${name}`), oracle);
      let yields = 0;
      let t = 0;
      const sliced = await analyzeSliced(loadFixture(`synthetic/${name}`), oracle, {
        sliceMs: 1,
        now: () => (t += 1),
        yieldToMain: () => {
          yields++;
          return Promise.resolve();
        },
      });
      expect(yields).toBeGreaterThan(0);
      expect(sliced.catches.map((c) => [c.marker.id, c.match.footnoteId, c.chips.length])).toEqual(
        direct.catches.map((c) => [c.marker.id, c.match.footnoteId, c.chips.length]),
      );
      expect(sliced.family).toBe(direct.family);
    },
  );
});

describe('large pages scan only main, footer and legal containers (ADR 0001 section 3)', () => {
  const filler = Array.from({ length: 60 }, (_, i) => `<p>Item ${String(i)} costs more.</p>`).join(
    '',
  );
  const html = `<body><header><p>Sale* now</p></header><div id="catalogue">${filler}</div>
    <main><p>Plans from $10/mo*</p></main>
    <footer><p>* Price after 12 months is $20/mo.</p></footer></body>`;

  it('scans the whole page when it is under the cap', () => {
    expect(scanScopes(parse(html).body, 1000)).toBeNull();
  });

  it('narrows to the outermost main and footer when it is over the cap', () => {
    const doc = parse(html);
    const scopes = scanScopes(doc.body, 40);
    expect(scopes?.map((e) => e.tagName)).toEqual(['MAIN', 'FOOTER']);
  });

  it('leaves the header out of the scan and still matches main to footer', () => {
    const doc = parse(html);
    const a = analyze(doc, createInlineStyleOracle(), { maxTextNodes: 40 });
    expect(a.catches).toHaveLength(1);
    expect(a.catches[0]?.marker.claimText).toContain('Plans from');
    expect(a.catches[0]?.match.footnoteId).not.toBeNull();
    const whole = analyze(parse(html), createInlineStyleOracle());
    expect(whole.catches.length).toBeGreaterThan(1);
  });

  it('scans the whole page when no main, footer or legal container exists', () => {
    const doc = parse(`<body>${filler}</body>`);
    expect(scanScopes(doc.body, 10)).toBeNull();
  });
});
