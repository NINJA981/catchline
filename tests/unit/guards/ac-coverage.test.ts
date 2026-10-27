// @vitest-environment node
// Every acceptance criterion in SPEC.md must be named by at least one test (extension unit and
// e2e, or site unit and e2e), or be listed below as a known gap with the reason. The matrix that
// explains how each one is covered is docs/TESTING.md.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');

/** Criteria with no test yet, and why. Keep this list honest: the second test fails if one is covered. */
const KNOWN_GAPS: Record<string, string> = {
  'AC-F9.1': 'needs the 30-page real corpus and the scorer (`pnpm corpus`), which do not exist yet',
  'AC-F9.2': 'needs the 30-page real corpus and the scorer; gates cannot be checked without it',
  'AC-F9.3': 'needs `pnpm corpus:readme` and a report.json to regenerate the README table from',
  'AC-F11.3': 'needs a bundled corpus report.json; Options says "Not yet measured" until then',
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'test-results' || name === '.output') return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

const specIds = [
  ...readFileSync(join(ROOT, 'SPEC.md'), 'utf8').matchAll(/^- (AC-[A-Z0-9.]+)/gm),
].map((m) => m[1] as string);
const testText = [...files(join(ROOT, 'tests')), ...files(join(ROOT, 'site', 'tests'))]
  .filter((f) => !f.endsWith('ac-coverage.test.ts'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
const mentioned = new Set(testText.match(/AC-[A-Z0-9.]*[0-9]/g) ?? []);

describe('SPEC acceptance criteria are all accounted for', () => {
  it('reads the criteria from SPEC.md', () => {
    expect(specIds.length).toBeGreaterThanOrEqual(50);
    expect(new Set(specIds).size).toBe(specIds.length);
  });

  it('every criterion is named by a test, or is a listed gap', () => {
    const missing = specIds.filter((id) => !mentioned.has(id) && !(id in KNOWN_GAPS));
    expect(missing).toEqual([]);
  });

  it('a listed gap is really uncovered (remove it from the list when a test lands)', () => {
    const covered = Object.keys(KNOWN_GAPS).filter((id) => mentioned.has(id));
    expect(covered).toEqual([]);
    for (const id of Object.keys(KNOWN_GAPS)) expect(specIds).toContain(id);
  });

  it('tests only name criteria that exist in SPEC.md', () => {
    const unknown = [...mentioned].filter((id) => !specIds.includes(id));
    expect(unknown).toEqual([]);
  });
});
