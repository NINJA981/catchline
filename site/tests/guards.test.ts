import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CSP } from '../vite.config.ts';

const root = resolve(import.meta.dirname, '..');

function files(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, ext, out);
    else if (ext.test(name)) out.push(full);
  }
  return out;
}

const read = (p: string): string => readFileSync(p, 'utf8');

// Spacing, radius and type scales from DESIGN.md (5px is the keycap's own padding token).
const SPACING = new Set([0, 1, 2, 4, 5, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]);
const RADII = new Set([0, 4, 6, 8, 12, 2]); // 2px is the mark inside the fine-print block
const FONT_SIZES = new Set([11, 12, 13, 14, 16, 18, 22, 26, 28, 32, 44]);

/** Rules of a stylesheet as [selector, body] pairs, ignoring comments. */
function rules(css: string): [string, string][] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: [string, string][] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of clean.matchAll(re)) out.push([(m[1] ?? '').trim(), m[2] ?? '']);
  return out;
}

const cssFiles = files(join(root, 'src/styles'), /\.css$/);

describe('design tokens only', () => {
  it('no color literal outside the shared token file', () => {
    for (const f of cssFiles) {
      const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css, f).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/);
    }
  });

  it('padding, margin and gap use the spacing scale', () => {
    for (const f of cssFiles) {
      for (const [sel, body] of rules(read(f))) {
        if (sel.includes('.sp-')) continue; // the specimen is the host page being demonstrated
        for (const m of body.matchAll(
          /(?:^|;)\s*(?:padding|margin|gap|row-gap|column-gap)[\w-]*\s*:\s*([^;]+)/g,
        )) {
          const value = m[1] ?? '';
          if (/var\(|calc\(/.test(value) && !/\d+px/.test(value.replace(/var\([^)]*\)/g, '')))
            continue;
          for (const px of value.matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
            expect(SPACING.has(Math.abs(Number(px[1]))), `${f} ${sel}: ${value}`).toBe(true);
          }
        }
      }
    }
  });

  it('radii and font sizes come from the scales', () => {
    for (const f of cssFiles) {
      for (const [sel, body] of rules(read(f))) {
        if (sel.includes('.sp-')) continue;
        for (const m of body.matchAll(/(?:^|;)\s*border-radius\s*:\s*([^;]+)/g)) {
          for (const px of (m[1] ?? '').matchAll(/(\d+)px/g)) {
            expect(RADII.has(Number(px[1])), `${f} ${sel}: ${m[1] ?? ''}`).toBe(true);
          }
        }
        for (const m of body.matchAll(/(?:^|;)\s*font-size\s*:\s*([^;]+)/g)) {
          const v = (m[1] ?? '').trim();
          const px = /^(\d+)px$/.exec(v);
          if (px) expect(FONT_SIZES.has(Number(px[1])), `${f} ${sel}: ${v}`).toBe(true);
          else expect(v, `${f} ${sel}`).toMatch(/^(clamp\(|inherit|0\.7em|12px)/);
        }
      }
    }
  });

  it('buttons are at least 44px tall and rows at least 44px', () => {
    const css = cssFiles.map(read).join('\n');
    const btn = rules(css).find(([s]) => s === '.btn');
    expect(btn?.[1]).toMatch(/min-height:\s*44px/);
    expect(rules(css).find(([s]) => s === '.btn--lg')?.[1]).toMatch(/min-height:\s*48px/);
    expect(rules(css).find(([s]) => s === '.sample')?.[1]).toMatch(/min-height:\s*56px/);
  });

  it('no transition: all, no outline: none without focus-visible, no gradients', () => {
    for (const f of cssFiles) {
      const css = read(f);
      expect(css, f).not.toMatch(/transition:\s*all/);
      expect(css, f).not.toMatch(/gradient\(/);
      for (const [sel, body] of rules(css)) {
        if (/outline:\s*none/.test(body)) expect(sel, f).toMatch(/:focus:not\(:focus-visible\)/);
      }
    }
  });
});

describe('privacy and offline guarantees', () => {
  const pages = ['index.html', 'app/index.html'].map((p) => [p, read(join(root, p))] as const);

  it.each(pages)('%s has no inline script or style and no external URL', (_name, html) => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style[\s>]/);
    expect(html).not.toMatch(/(?:src|href)=["']https?:/);
    expect(html).not.toMatch(/ style=/);
  });

  it('source has no network primitive', () => {
    for (const f of files(join(root, 'src'), /\.ts$/)) {
      const code = read(f)
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code, f).not.toMatch(
        /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts/,
      );
      expect(code, f).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    }
  });

  it('the engine is imported through the alias, never copied or reached by relative path', () => {
    for (const f of files(join(root, 'src'), /\.ts$/)) {
      const code = read(f);
      expect(code, f).not.toMatch(/from ['"](?:\.\.\/)+src\/core/);
      expect(code, f).not.toMatch(/from ['"]\.\.\/\.\.\/\.\.\/src\//);
    }
    expect(files(join(root, 'src'), /\.ts$/).some((f) => /[\\/]core[\\/]/.test(f))).toBe(false);
  });

  it('every file the HTML loads can be served from its own origin (CSP is closed)', () => {
    expect(CSP).toContain("default-src 'none'");
    expect(CSP).toContain("connect-src 'none'");
    expect(CSP).not.toMatch(/https?:/);
    expect(CSP).not.toContain("script-src 'unsafe");
  });

  it('manifest is installable', () => {
    const m = JSON.parse(read(join(root, 'public/manifest.webmanifest'))) as Record<
      string,
      unknown
    >;
    expect(m.start_url).toBe('./app/');
    expect(m.display).toBe('standalone');
    const sizes = (m.icons as { sizes: string }[]).map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });

  it('copy rules: no all-caps eyebrows, arrows on buttons, lorem or fake stats', () => {
    for (const [name, html] of pages) {
      expect(html, name).not.toMatch(/lorem ipsum/i);
      expect(html, name).not.toMatch(/text-transform:\s*uppercase/);
      expect(html, name).not.toMatch(/<(?:a|button)[^>]*class="btn[^"]*"[^>]*>[^<]*(?:→|&rarr;)/);
      expect(html, name).not.toMatch(/\b\d{2,}\+? (?:stars|users|installs|downloads)\b/i);
    }
  });
});
