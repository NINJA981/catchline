// @vitest-environment node
// AC-X.2: the built extension bundle contains no `fetch(`, `XMLHttpRequest`, `WebSocket` or
// `sendBeacon`. This runs scripts/check-network.mjs on .output/chrome-mv3 and on the Firefox build
// when they exist (`pnpm build` first). The check itself is also proven to bite.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-network.mjs');

function run(dir: string) {
  return spawnSync(process.execPath, [SCRIPT, dir], { cwd: ROOT, encoding: 'utf8' });
}

describe('AC-X.2: the built bundle makes no network calls', () => {
  it.each(['chrome-mv3', 'firefox-mv3'])('%s build is clean', (target) => {
    const dir = join(ROOT, '.output', target);
    if (!existsSync(join(dir, 'manifest.json'))) {
      // Not built in this run. The e2e script and `pnpm verify` build first.
      return;
    }
    const r = run(dir);
    expect(r.stderr + r.stdout).toContain('ok');
    expect(r.status).toBe(0);
  });

  it('the check fails on a bundle that calls fetch', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catchline-net-'));
    try {
      writeFileSync(
        join(dir, 'manifest.json'),
        JSON.stringify({ manifest_version: 3, name: 'x', version: '1' }),
      );
      writeFileSync(join(dir, 'bad.js'), 'export const f = () => fetch("https://example.test/x");');
      expect(run(dir).status).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
