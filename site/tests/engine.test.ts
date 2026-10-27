import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ledgerRows, segmentText } from '@catchline/core';
import { SAMPLES, loadSample } from '../src/app/samples';
import { hostFromDocument } from '../src/app/share';
import { InputError, looksLikeHtml, parseInput } from '../src/engine/parse';
import { createPastedPageOracle, parseFontSizeRules } from '../src/engine/oracle';
import { scanInput } from '../src/engine/scan';
import { finePrintFor } from '../src/shared/card';

const root = resolve(import.meta.dirname, '..');

describe('parseInput', () => {
  it('rejects empty input with an actionable message', () => {
    expect(() => parseInput('  \n ')).toThrow(InputError);
    try {
      parseInput('');
    } catch (e) {
      expect((e as InputError).kind).toBe('empty');
      expect((e as InputError).message).toMatch(/Paste/);
    }
  });

  it('rejects input over the size cap', () => {
    expect(() => parseInput('a'.repeat(2_000_001))).toThrow(/2 million/);
  });

  it('tells HTML from text', () => {
    expect(looksLikeHtml('<p>Hi*</p>')).toBe(true);
    expect(looksLikeHtml('5 < a and b > 3, $0/mo*')).toBe(false);
    expect(parseInput('Unlimited¹\n\n¹Slow after 50GB').kind).toBe('text');
  });

  it('never turns pasted text into markup', () => {
    const { doc } = parseInput('5 < 6 &amp; <b not html');
    expect(doc.body.querySelectorAll('b').length).toBe(0);
  });

  it('does not run scripts or fetch images in pasted HTML', () => {
    (globalThis as { __ran?: boolean }).__ran = false;
    const { doc } = parseInput(
      '<p>x</p><script>globalThis.__ran = true</script><img src="https://x.example/p.png">',
    );
    expect((globalThis as { __ran?: boolean }).__ran).toBe(false);
    expect(doc.querySelector('script')).not.toBeNull();
  });
});

describe('createPastedPageOracle', () => {
  it('reads inline sizes, <style> rules, small and keywords', () => {
    const { doc } = parseInput(
      '<style>.legal{font-size:11px} footer p{font-size:9px} @media print{.legal{font-size:30px}}</style>' +
        '<p class="legal" id="a">x</p><footer><p id="b">y</p></footer><p id="c" style="font-size:0.75em">z</p><small id="d">s</small><p id="e">plain</p>',
    );
    const o = createPastedPageOracle(doc);
    const px = (id: string) => o.fontSizePx(doc.getElementById(id) as Element);
    expect(px('a')).toBe(11);
    expect(px('b')).toBe(9);
    expect(px('c')).toBeCloseTo(12);
    expect(px('d')).toBeCloseTo(13);
    expect(px('e')).toBe(16);
  });

  it('prefers the more specific rule and ignores at-rules', () => {
    const rules = parseFontSizeRules(
      'p{font-size:14px} #x{font-size:10px} @media (max-width:1px){p{font-size:99px}}',
    );
    expect(rules.map((r) => r.value)).toEqual(['14px', '10px']);
    expect(rules[1]?.specificity).toBeGreaterThan(rules[0]?.specificity ?? 0);
  });
});

describe('AC-W3: samples run through the real engine', () => {
  const expected: Record<string, { counted: number; listed: number }> = {
    'carrier-specimen': { counted: 3, listed: 3 },
    'bank-specimen': { counted: 5, listed: 5 },
    'retail-specimen': { counted: 4, listed: 4 },
    'streaming-specimen': { counted: 3, listed: 3 },
    'saas-specimen': { counted: 4, listed: 4 },
    'travel-specimen': { counted: 3, listed: 3 },
    'many-to-one': { counted: 12, listed: 14 },
    'not-found': { counted: 0, listed: 3 },
  };

  it.each(SAMPLES.map((s) => s.id))('%s', async (id) => {
    const scan = scanInput(await loadSample(id));
    const want = expected[id];
    expect(want).toBeDefined();
    expect(scan.rollup.catches).toBe(want?.counted);
    expect(scan.analysis.catches.length).toBe(want?.listed);
    // Every marker and every matched footnote can be found again in the reader.
    for (const c of scan.analysis.catches) {
      expect(scan.reader.markerBlock.has(c.marker.id)).toBe(true);
      if (c.match.footnoteId) expect(scan.reader.footnoteBlock.has(c.match.footnoteId)).toBe(true);
    }
  });

  it('plain pasted text works and says where the fine print is', () => {
    const scan = scanInput(
      'Unlimited data¹ for $0/mo*\n\n*With a 36-month installment agreement. $35 activation fee. Autopay required.\n¹Speeds may slow after 50GB.',
    );
    expect(scan.parsed.kind).toBe('text');
    expect(scan.rollup.catches).toBeGreaterThan(0);
    expect(scan.summary).toMatch(/catch/);
  });

  it('finds nothing in prose without markers', () => {
    expect(scanInput('Just a paragraph about nothing at all.').analysis.catches).toEqual([]);
  });
});

describe('landing page matches the engine (no invented numbers)', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  // Stylesheets and scripts are not needed (and happy-dom would try to load them).
  const page = new DOMParser().parseFromString(
    html.replace(/<link[^>]*>/g, '').replace(/<script[\s\S]*?<\/script>/g, ''),
    'text/html',
  );

  it('hero card chips, fine print and marks equal the engine output for the carrier specimen', async () => {
    const scan = scanInput(await loadSample('carrier-specimen'));
    const first = scan.ordered[0];
    expect(first?.marker.claimText).toBe('$0/mo*');
    const fine = first ? finePrintFor(first, scan.analysis) : null;
    const card = page.querySelector('#hero-card');
    const chips = Array.from(card?.querySelectorAll('.chip') ?? []).map((c) =>
      c.textContent.trim(),
    );
    expect(chips).toEqual(first?.chips.map((c) => c.label));
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(norm(card?.querySelector('.fine__text')?.textContent ?? '')).toBe(fine?.text);
    const marks = Array.from(card?.querySelectorAll('.fine__text mark') ?? []).map(
      (m) => m.textContent,
    );
    expect(marks).toEqual(
      segmentText(fine?.text ?? '', fine?.spans ?? [])
        .filter((s) => s.mark)
        .map((s) => s.text),
    );
    expect(norm(page.querySelector('#footnote')?.textContent ?? '')).toBe(fine?.text);
  });

  it('popup mock rows equal the engine ledger and catch list', async () => {
    const scan = scanInput(await loadSample('carrier-specimen'));
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const rows = Array.from(page.querySelectorAll('#popup-mock .ledger__row')).map((r) =>
      norm(r.querySelector('dd')?.textContent ?? ''),
    );
    expect(rows).toEqual(ledgerRows(scan.rollup).map((r) => r.value));
    expect(norm(page.querySelector('#popup-mock .popup__count')?.textContent ?? '')).toBe(
      String(scan.rollup.catches),
    );
    expect(norm(page.querySelector('.toolbar__badge')?.textContent ?? '')).toBe(
      String(scan.rollup.catches),
    );
    const claims = Array.from(page.querySelectorAll('#popup-mock .catch-row__claim')).map((r) =>
      norm(r.textContent),
    );
    expect(claims).toEqual(scan.ordered.map((c) => c.marker.claimText));
    const chipLines = Array.from(page.querySelectorAll('#popup-mock .catch-row__chips')).map((r) =>
      norm(r.textContent),
    );
    expect(chipLines).toEqual(
      scan.ordered.map((c) =>
        c.chips
          .slice(0, 3)
          .map((x) => x.label)
          .join(', '),
      ),
    );
  });
});

describe('hostFromDocument', () => {
  it('prefers canonical, then the first absolute link', () => {
    const a = new DOMParser().parseFromString(
      '<link rel="canonical" href="https://www.shop.example/x"><a href="https://other.example/">o</a>',
      'text/html',
    );
    expect(hostFromDocument(a)).toBe('shop.example');
    const b = new DOMParser().parseFromString(
      '<a href="https://ridgeline.example/plans">p</a>',
      'text/html',
    );
    expect(hostFromDocument(b)).toBe('ridgeline.example');
    expect(
      hostFromDocument(new DOMParser().parseFromString('<p>no links</p>', 'text/html')),
    ).toBeNull();
  });
});
