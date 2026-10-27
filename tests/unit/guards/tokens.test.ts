// @vitest-environment node
// DESIGN.md is the source of truth for color. src/ui/tokens.css copies its values verbatim; this
// test fails if either side drifts, and checks the UI CSS uses no off-token values.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BADGE_BACKGROUND, BADGE_TEXT } from '../../../src/adapters/badge';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
const css = ['base.tokens.css', 'tokens.css']
  .map((f) => readFileSync(join(ROOT, 'src', 'ui', f), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Whitespace and trailing zeros do not count: Prettier writes 0.40 as 0.4 in CSS. */
const norm = (v: string) =>
  v
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/-?\d*\.?\d+/g, (n) => String(Number(n)));

function designColors(): Map<string, string> {
  const front = /^---\n([\s\S]*?)\n---/.exec(design)?.[1] ?? '';
  const block = /\ncolors:\n([\s\S]*?)\n\w/.exec(`\n${front}`)?.[1] ?? '';
  const out = new Map<string, string>();
  for (const line of block.split('\n')) {
    const m = /^\s{2}([a-z0-9-]+):\s*"([^"]+)"/.exec(line);
    if (m?.[1] && m[2]) out.set(m[1], m[2]);
  }
  return out;
}

/** Custom properties declared in the first rule whose selector matches. */
function declarations(selector: RegExp): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.test(norm(r[1] ?? ''))) continue;
    for (const d of (r[2] ?? '').matchAll(/(--cl-[a-z0-9-]+):\s*([^;]+);/g)) {
      if (d[1] && d[2]) out.set(d[1], norm(d[2]));
    }
    break;
  }
  return out;
}

describe('design tokens', () => {
  const colors = designColors();
  const light = declarations(/^:root, :host$/);
  const dark = declarations(/^:root\[data-theme='dark'\]/);

  it('reads the DESIGN.md palette', () => {
    expect(colors.size).toBeGreaterThanOrEqual(39);
    expect(colors.get('prussian')).toBe('oklch(0.45 0.10 238)');
  });

  it('wires every light color from DESIGN.md', () => {
    for (const [name, value] of colors) {
      if (name.endsWith('-dark')) continue;
      expect(light.get(`--cl-${name}`), name).toBe(norm(value));
    }
  });

  it('wires every dark color from DESIGN.md', () => {
    for (const [name, value] of colors) {
      if (!name.endsWith('-dark')) continue;
      const base = name.slice(0, -5);
      expect(dark.get(`--cl-${base}`), base).toBe(norm(value));
    }
  });

  it('follows the system theme in dark mode unless a theme is forced', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(":root:not([data-theme='light'])");
    expect(css).toContain(":root[data-theme='dark']");
  });

  it('exposes every color as a Tailwind v4 @theme variable', () => {
    const theme = /@theme inline \{([\s\S]*)\n\}/.exec(css)?.[1] ?? '';
    expect(theme).toContain('--*: initial;');
    for (const name of colors.keys()) {
      if (name.endsWith('-dark')) continue;
      const alias = name === 'ledger-paper' ? 'paper' : name;
      expect(theme, name).toContain(`--color-${alias}: var(--cl-${name});`);
    }
  });

  it('keeps spacing on the 4px grid and type in px (host pages override rem)', () => {
    expect(css).toContain('--spacing: 4px;');
    const theme = /@theme inline \{([\s\S]*)\n\}/.exec(css)?.[1] ?? '';
    expect(theme).not.toMatch(/\d(?:\.\d+)?rem\b/);
  });

  it('matches the DESIGN.md type scale', () => {
    for (const [token, size] of [
      ['display', '44px'],
      ['h1', '28px'],
      ['h2', '22px'],
      ['body', '14px'],
      ['ui', '13px'],
      ['caption', '12px'],
      ['micro', '11px'],
    ] as const) {
      expect(css).toContain(`--text-${token}: ${size};`);
    }
  });

  it('has no raw colors, rem sizes or palette classes outside tokens.css', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(css|tsx)$/.test(name) && !p.endsWith('tokens.css')) {
          const text = readFileSync(p, 'utf8');
          const shown = p.slice(ROOT.length);
          if (/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i.test(text)) offenders.push(shown);
          if (/\b\d+(?:\.\d+)?rem\b/.test(text)) offenders.push(`${shown} (rem)`);
          if (
            /\b(?:bg|text|border)-(?:red|blue|gray|slate|zinc|green|black|white)-?\d*\b/.test(text)
          ) {
            offenders.push(`${shown} (raw palette class)`);
          }
        }
      }
    };
    walk(join(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });

  it('keeps the toolbar badge hex in step with the OKLCH tokens (the badge API takes hex only)', () => {
    expect(oklchToHex(colors.get('prussian') ?? '')).toBe(BADGE_BACKGROUND);
    expect(oklchToHex(colors.get('on-prussian') ?? '')).toBe(BADGE_TEXT);
  });
});

/** OKLCH -> sRGB hex (Bjorn Ottosson's matrices), enough to check two tokens. */
function oklchToHex(value: string): string {
  const m = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value);
  if (!m) throw new Error(`Not an opaque oklch(): ${value}`);
  const [L, C, h] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const gamma = (x: number) => {
    const c = Math.min(1, Math.max(0, x));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  return `#${lin
    .map((x) =>
      Math.round(gamma(x) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
