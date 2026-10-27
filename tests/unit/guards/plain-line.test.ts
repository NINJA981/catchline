// @vitest-environment node
// AC-F12.1: with the setting off (the default) no built-in AI API is touched and no request code
// path is reachable. Today the setting is only a saved flag: nothing reads it to call a model.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../../src/core';

const SRC = join(import.meta.dirname, '..', '..', '..', 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const FILES = sources(SRC).map((f) => ({
  path: relative(SRC, f).split(sep).join('/'),
  code: strip(readFileSync(f, 'utf8')),
}));

describe('AC-F12.1: the plain-language line is off and inert', () => {
  it('is off by default and stays off for anything unreadable in storage', () => {
    expect(DEFAULT_SETTINGS.plainLine.enabled).toBe(false);
    for (const raw of [
      undefined,
      null,
      5,
      'on',
      [],
      {},
      { plainLine: null },
      { plainLine: { enabled: 'yes' } },
    ]) {
      expect(sanitizeSettings(raw).plainLine.enabled).toBe(false);
    }
    expect(sanitizeSettings({ plainLine: { enabled: true } }).plainLine.enabled).toBe(true);
  });

  it('no source calls a built-in AI API (LanguageModel, Summarizer, window.ai)', () => {
    const calls =
      /\b(?:LanguageModel|Summarizer|Rewriter|Writer|Translator)\s*\.\s*\w+\s*\(|\b(?:window|self|globalThis)\.ai\b|\bai\.(?:summarizer|languageModel|rewriter|writer)\b/;
    expect(FILES.filter((f) => calls.test(f.code)).map((f) => f.path)).toEqual([]);
  });

  it('the only mention of an on-device model is the feature check in Options, a typeof test', () => {
    const mentions = FILES.filter((f) => /\b(?:LanguageModel|Summarizer)\b/.test(f.code));
    expect(mentions.map((f) => f.path)).toEqual(['entrypoints/options/App.tsx']);
    const code = mentions[0]?.code ?? '';
    const uses = code.match(/\b(?:LanguageModel|Summarizer)\b/g) ?? [];
    const typeofTests =
      code.match(/typeof\s+g\.(?:LanguageModel|Summarizer)\s*!==\s*'undefined'/g) ?? [];
    expect(uses.length).toBe(typeofTests.length);
  });

  it('nothing outside settings and Options reads plainLine or byoKey, so no request path hangs off them', () => {
    const readers = FILES.filter((f) => /\b(?:plainLine|byoKey|byo-key)\b/.test(f.code)).map(
      (f) => f.path,
    );
    expect(readers.sort()).toEqual(['core/settings.ts', 'entrypoints/options/App.tsx']);
  });

  it('the extension makes no request from its own code', () => {
    const network = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/;
    expect(FILES.filter((f) => network.test(f.code)).map((f) => f.path)).toEqual([]);
  });
});
