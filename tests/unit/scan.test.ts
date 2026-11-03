import { classifyRun, scanMarkers } from '../../src/core';
import { loadFixture, parse } from './helpers';

function scan(html: string) {
  return scanMarkers(parse(`<body>${html}</body>`).body);
}

function scanFixture(name: string) {
  return scanMarkers(loadFixture(`synthetic/${name}`).body);
}

describe('F1 marker scanner: glyphs.html (AC-F1.1)', () => {
  const markers = scanFixture('glyphs.html');

  it('finds all 7 marker forms and 5 escape-hatch phrases, with zero misses', () => {
    expect(markers.map((m) => m.glyph)).toEqual([
      '*',
      '†',
      '‡',
      '§',
      '¶',
      'sup:2',
      'uni:3',
      'phrase',
      'phrase',
      'phrase',
      'phrase',
      'phrase',
    ]);
  });

  it('gives each marker the claim it qualifies', () => {
    expect(markers[0]?.claimText).toBe('Unlimited talk and text for $25/mo*');
    expect(markers[5]?.claimText).toContain('Fiber 1 Gig');
    expect(markers[7]?.claimText).toContain('Terms apply');
  });

  it('assigns stable, unique ids and document-order ordinals', () => {
    const again = scanFixture('glyphs.html');
    expect(again.map((m) => m.id)).toEqual(markers.map((m) => m.id));
    expect(new Set(markers.map((m) => m.id)).size).toBe(markers.length);
    expect(markers.map((m) => m.ordinal)).toEqual(markers.map((_, i) => i));
  });

  it('uses the footnote key the matcher looks for', () => {
    expect(markers.map((m) => m.key)).toEqual([
      '*',
      '†',
      '‡',
      '§',
      '¶',
      '2',
      '3',
      'phrase',
      'phrase',
      'phrase',
      'phrase',
      'phrase',
    ]);
  });

  it('keeps live element references and a text anchor for symbol markers', () => {
    const star = markers[0];
    expect(star?.claimEl.deref()?.tagName).toBe('P');
    const anchor = star?.anchor?.node.deref();
    expect(anchor?.data.slice(star?.anchor?.start, star?.anchor?.end)).toBe('*');
    const sup = markers[5];
    expect(sup?.markerEl?.deref()?.tagName).toBe('SUP');
    expect(markers[7]?.markerEl).toBeNull();
  });
});

describe('F1 exclusions: cents (AC-F1.2)', () => {
  it('finds no marker in cents.html', () => {
    expect(scanFixture('cents.html')).toEqual([]);
  });

  it.each([
    '$49<sup>99</sup>',
    '$4<sup>.99</sup> a month',
    'Only 19<sup>99</sup>',
    '€9<sup>,99</sup>',
    '$1,299<sup>00</sup>',
  ])('ignores cents superscript in %s', (html) => {
    expect(scan(`<p>${html}</p>`)).toEqual([]);
  });

  it('still reads a single digit after a price as a footnote', () => {
    const markers = scan('<p>Only $50<sup>1</sup> per month</p>');
    expect(markers.map((m) => m.glyph)).toEqual(['sup:1']);
  });

  it.each([
    ['Sign in<sup>1</sup> to see your price', 'sup:1'],
    ['Earn 5x<sup>1</sup> points on dining', 'sup:1'],
    ['Only $10<sup>a</sup> a month', 'sup:a'],
    ['Starting at $9.99<sup>1</sup> a month', 'sup:1'],
  ])('reads the superscript in "%s" as a footnote (code review r1)', (html, glyph) => {
    expect(scan(`<p>${html}</p>`).map((m) => m.glyph)).toEqual([glyph]);
  });

  it.each([
    '1<sup>st</sup> place',
    'Lumen<sup>®</sup>',
    'Lumen<sup>TM</sup> mesh',
    '10<sup>-3</sup>',
  ])('ignores ordinals, trademarks and exponents in %s', (html) => {
    expect(scan(`<p>${html}</p>`)).toEqual([]);
  });
});

describe('F1 exclusions: code, math, bullets, ratings (AC-F1.3)', () => {
  it('finds no marker in math-code.html', () => {
    expect(scanFixture('math-code.html')).toEqual([]);
  });

  it.each([
    ['code', '<code>price*</code>'],
    ['pre', '<pre>total = base*†</pre>'],
    ['kbd', 'Press <kbd>*</kbd> now'],
    ['samp', '<samp>Error*</samp>'],
    ['math', '<math><mi>p</mi><mo>*</mo></math>'],
    ['katex', '<span class="katex">A†A</span>'],
    ['MathJax', '<div class="MathJax_Display">x*</div>'],
    ['Catchline UI', '<div data-catchline>Price*</div>'],
  ])('skips %s subtrees', (_name, html) => {
    expect(scan(`<p>${html}</p>`)).toEqual([]);
  });

  it('skips fine print itself, so footnote lines are never claims', () => {
    expect(scan('<footer><p>Price$* applies</p><p>$0/mo*</p></footer>')).toEqual([]);
  });

  // Code review r1, finding 9.
  it('scans claims inside a class that merely contains "fine" or "legal"', () => {
    expect(scan('<div class="refined-grid"><p>$0/mo*</p></div>')).toHaveLength(1);
    expect(scan('<div class="paralegal-services"><p>From $99*</p></div>')).toHaveLength(1);
  });

  it('reads a Pandoc or markdown-it footnote reference as a marker', () => {
    const markers = scan(
      '<p>Plans start at $20<a href="#fn1" class="footnote-ref"><sup>1</sup></a> a month</p>',
    );
    expect(markers.map((m) => m.glyph)).toEqual(['sup:1']);
  });

  it('skips hidden subtrees', () => {
    expect(scan('<p hidden>$0/mo*</p><div aria-hidden="true">$5*</div>')).toEqual([]);
    expect(scan('<details><p>$0/mo*</p></details>')).toEqual([]);
  });
});

describe('classifyRun', () => {
  it.each([
    ['*', '$0/mo', ' ', '*'],
    ['†', 'bonus', '', '†'],
    ['‡', 'Fee', ' x', '‡'],
    ['§', 'APR', '', '§'],
    ['¶', 'dining', '', '¶'],
    ['*', 'plan', '. Next', '*'],
    ['**', 'offer', '', '**'],
    ['††', 'offer', '', '††'],
  ])('accepts %s attached to the claim', (run, prev, next, glyph) => {
    expect(classifyRun(run, prev, next)?.glyph).toBe(glyph);
  });

  it('reads Unicode superscripts as numbered footnotes', () => {
    expect(classifyRun('³', 'bundle', ' ')).toEqual({ glyph: 'uni:3', key: '3' });
    expect(classifyRun('¹²', 'bundle', ' ')).toEqual({ glyph: 'uni:12', key: '12' });
  });

  // Code review r1, finding 1 and 7: a decimal price, an English word that is also a unit, and a
  // multiplier are claims, not exponents.
  it.each([
    ['¹', 'Starting at $9.99'],
    ['²', 'Only €4.50'],
    ['¹', 'Sign in'],
    ['¹', 'Earn 5x'],
  ])('reads %s after "%s" as a footnote marker', (run, prev) => {
    expect(classifyRun(run, prev, ' ')?.glyph).toBe(`uni:${run === '¹' ? '1' : '2'}`);
  });

  it('still rejects a superscript after inches written with a number', () => {
    expect(classifyRun('²', '12 in', ' ')).toBeNull();
  });

  it.each([
    ['*', ' ', 'bullet after space'],
    ['*', '', 'nothing before'],
    ['*', '2', 'multiplication', '3'],
    ['*', 'files', 'wildcard', '.pdf'],
    ['***', 'rating', 'rating'],
    ['*****', 'rating', 'rating'],
    ['§', 'See', 'section sign before a number', ' 1026'],
    ['¶', 'See', 'paragraph sign before a number', ' 12'],
    ['²', 'm', 'square metres'],
    ['³', '10', 'cubed number'],
    ['⁴', 'x', 'exponent'],
    ['¹²³⁴', 'word', 'too long'],
  ])('rejects %s: %s', (run, prev, _why, next = ' ') => {
    expect(classifyRun(run, prev, next)).toBeNull();
  });
});

describe('F1 plain-text emphasis', () => {
  it('does not treat *emphasis* as markers', () => {
    expect(scan('<p>This is *plain text* emphasis</p>')).toEqual([]);
  });

  it('keeps a real asterisk at the end of a sentence', () => {
    expect(scan('<p>Free shipping*</p>').map((m) => m.glyph)).toEqual(['*']);
  });
});

describe('F1 superscript markers', () => {
  it('reads bracketed and lettered superscripts', () => {
    expect(scan('<p>Claim<sup>[4]</sup> and other<sup>a</sup></p>').map((m) => m.key)).toEqual([
      '4',
      'a',
    ]);
  });

  it('reads symbol superscripts', () => {
    expect(scan('<p>Free<sup>†</sup></p>').map((m) => m.glyph)).toEqual(['†']);
  });

  it('ignores a superscript at the start of a block (a footnote definition)', () => {
    expect(scan('<p><sup>2</sup> Fiber speeds are wired maximums.</p>')).toEqual([]);
  });

  it('reads a bare reference link as a marker', () => {
    const markers = scan('<p>Claim <a href="#fn1">[1]</a>.</p><ol><li id="fn1">Note</li></ol>');
    expect(markers.map((m) => m.key)).toEqual(['1']);
  });
});

describe('F1 phrases', () => {
  it('finds each escape-hatch phrase', () => {
    for (const phrase of [
      'Terms apply',
      'Terms and conditions apply',
      'See offer details',
      'Restrictions apply',
      'Conditions apply',
      'Some exclusions apply',
    ]) {
      const markers = scan(`<p>Great offer. ${phrase}.</p>`);
      expect(markers.map((m) => m.glyph)).toEqual(['phrase']);
    }
  });

  it('drops a phrase when its block already has a symbol marker', () => {
    const markers = scan('<p>$0/mo* Terms apply.</p>');
    expect(markers.map((m) => m.glyph)).toEqual(['*']);
  });
});

describe('F1 claim text', () => {
  it('narrows a long block to the sentence that holds the marker', () => {
    const filler = 'This filler sentence adds length to the paragraph without a marker. '.repeat(5);
    const markers = scan(`<p>${filler}Unlimited data for $25/mo*. ${filler}</p>`);
    expect(markers).toHaveLength(1);
    expect(markers[0]?.claimText).toContain('Unlimited data for $25/mo');
    expect(markers[0]?.claimText.length).toBeLessThanOrEqual(200);
  });

  it('caps claim text at 200 characters', () => {
    const markers = scan(`<p>${'word '.repeat(80)}claim*</p>`);
    expect(markers[0]?.claimText.length).toBeLessThanOrEqual(200);
  });
});

describe('F1 performance (AC-F1.4)', () => {
  it('scans a large page quickly', () => {
    const rows: string[] = [];
    for (let i = 0; i < 400; i++) {
      rows.push(
        `<section><h3>Plan ${String(i)}</h3><p>Unlimited data for $${String(i)}/mo*</p></section>`,
      );
    }
    const doc = parse(`<body>${rows.join('')}</body>`);
    const times: number[] = [];
    for (let run = 0; run < 7; run++) {
      const t0 = performance.now();
      const found = scanMarkers(doc.body);
      times.push(performance.now() - t0);
      expect(found).toHaveLength(400);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] ?? Infinity;
    // Spec target: 50 ms median on the largest corpus page (gate at 2x on CI hardware).
    expect(median).toBeLessThan(100);
  });
});
