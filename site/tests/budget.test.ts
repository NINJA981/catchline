// AC-W12 (the part a unit test can hold): initial JS stays inside the budget and no WebGL ships.
// Runs scripts/check-budget.mjs against ../.output/site when the site is built. The LCP, CLS and
// Lighthouse numbers in AC-W12 are measured with a throttled trace and are recorded in
// ../docs/TESTING.md, not asserted here.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const built = existsSync(join(root, '..', '.output', 'site', 'index.html'));

describe('AC-W12: bundle budget', () => {
  it.skipIf(!built)('initial JS is at most 120 KB gzip on both pages, with no WebGL', () => {
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'check-budget.mjs')], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(r.stdout).toMatch(/landing initial JS/);
    expect(r.stdout).toMatch(/app initial JS/);
    expect(r.status).toBe(0);
  });
});
