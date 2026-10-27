// Fixture loading for unit tests. Fixtures are plain HTML files in tests/fixtures (see README).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, type Analysis } from '../../src/core/analyze';
import { createInlineStyleOracle } from '../../src/core/style';
import type { Catch } from '../../src/core/types';

export const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

export function fixtureHtml(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

/** Parse HTML into a fresh document (happy-dom). */
export function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function loadFixture(name: string): Document {
  return parse(fixtureHtml(name));
}

export function analyzeHtml(html: string): Analysis {
  return analyze(parse(html), createInlineStyleOracle());
}

export function analyzeFixture(name: string): Analysis {
  return analyze(loadFixture(name), createInlineStyleOracle());
}

/** The footnote text a catch shows: the chosen sentence or the whole body. */
export function shownText(a: Analysis, c: Catch): string | null {
  if (!c.match.footnoteId) return null;
  const fn = a.footnotes.get(c.match.footnoteId);
  if (!fn) return null;
  const s = c.match.sentence;
  return s ? fn.block.text.slice(s.start, s.end) : fn.body;
}

export function byClaim(a: Analysis, fragment: string): Catch {
  const c = a.catches.find((x) => x.marker.claimText.includes(fragment));
  if (!c) {
    throw new Error(
      `No catch with claim containing "${fragment}". Claims: ${a.catches.map((x) => x.marker.claimText).join(' | ')}`,
    );
  }
  return c;
}
