// @vitest-environment node
// The engine in src/core is shared with the web app (site/). It must run with no DOM globals, no
// extension APIs and no network. ESLint enforces the imports; this test checks the sources and
// proves the modules load and run in a plain Node context.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as core from '../../../src/core';

const CORE_DIR = join(import.meta.dirname, '..', '..', '..', 'src', 'core');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sources(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FILES = sources(CORE_DIR);
const rel = (f: string) => f.slice(CORE_DIR.length);

describe('src/core boundary', () => {
  it('finds the engine sources', () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  it.each([
    [
      'chrome.* / browser.* APIs',
      /\b(?:chrome|browser)\.(?:runtime|storage|tabs|action|scripting|permissions|i18n)\b/,
    ],
    ['network calls', /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|sendBeacon/],
    ['page globals', /\b(?:window|document|localStorage|sessionStorage|location|navigator)\./],
    ['console output', /\bconsole\./],
  ])('contains no %s', (_name, pattern) => {
    const offenders = FILES.filter((f) => pattern.test(stripComments(readFileSync(f, 'utf8')))).map(
      rel,
    );
    expect(offenders).toEqual([]);
  });

  it('imports only from inside src/core', () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const depth = rel(f).split(/[\\/]/).length - 2; // folders below src/core
      for (const m of readFileSync(f, 'utf8').matchAll(/from\s+'([^']+)'/g)) {
        const spec = m[1] ?? '';
        if (!spec.startsWith('.')) bad.push(`${rel(f)} -> ${spec}`);
        else if ((spec.match(/\.\.\//g) ?? []).length > depth) bad.push(`${rel(f)} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('has one entry module that exports the whole engine', () => {
    for (const name of [
      'analyze',
      'scanMarkers',
      'matchMarkers',
      'extractChips',
      'buildRollup',
      'rollupSummary',
      'badgeText',
      'cardState',
      'derivePopupView',
      'showAllReducer',
      'sanitizeSettings',
      'createComputedStyleOracle',
      'createInlineStyleOracle',
    ]) {
      expect(typeof (core as Record<string, unknown>)[name], name).toBe('function');
    }
  });

  it('runs its text-only functions with no DOM at all', () => {
    expect(typeof document).toBe('undefined');
    const chips = core.extractChips('$35 activation fee. Autopay required.');
    expect(chips.map((c) => c.label)).toEqual(['$35 activation', 'Autopay required']);
    expect(core.rollupSummary(core.buildRollup(1, [], 0))).toBe('No catches on this page');
    expect(core.splitSentences('One. Two.')).toHaveLength(2);
    expect(core.sanitizeSettings(undefined)).toEqual(core.DEFAULT_SETTINGS);
  });
});
