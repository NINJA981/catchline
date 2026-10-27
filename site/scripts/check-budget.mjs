// Budget gate for the built site (bible 11.3 B1/B2, DESIGN.md Landing Page 3D plan).
//   node scripts/check-budget.mjs   (after `pnpm build`)
// Initial JS per page = the entry module plus the chunks it imports statically (what the browser
// must download before the page works). Lazy chunks (the sample pages) are listed, not counted.
// The page has no WebGL: DESIGN.md chose CSS/SVG, so a canvas 3D chunk must never appear.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = resolve(import.meta.dirname, '../../.output/site');
const LIMIT_INITIAL_JS_GZ = 120 * 1024; // landing initial JS, bible 11.3
const LIMIT_APP_INITIAL_JS_GZ = 120 * 1024;
const LIMIT_POSTER_FREE = 0; // no 3D assets at all

const gz = (file) => gzipSync(readFileSync(file)).length;
let failed = false;

function initialScripts(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const base = dirname(htmlPath);
  const seen = new Set();
  const queue = [];
  for (const m of html.matchAll(/<(?:script|link)[^>]*?(?:src|href)="([^"]+\.js)"/g)) {
    queue.push(resolve(base, m[1]));
  }
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const code = readFileSync(file, 'utf8');
    // Static imports only: `import ... from "./x.js"` and `import "./x.js"`, not import("...").
    for (const m of code.matchAll(
      /(?:^|[;}\n])\s*import\s*(?:[^"'(]*?from\s*)?["'](\.[^"']+\.js)["']/g,
    )) {
      queue.push(resolve(dirname(file), m[1]));
    }
  }
  return [...seen];
}

for (const [name, page, limit] of [
  ['landing', join(dist, 'index.html'), LIMIT_INITIAL_JS_GZ],
  ['app', join(dist, 'app/index.html'), LIMIT_APP_INITIAL_JS_GZ],
]) {
  const files = initialScripts(page);
  const total = files.reduce((n, f) => n + gz(f), 0);
  const ok = total <= limit;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name} initial JS: ${(total / 1024).toFixed(1)} KB gzip (limit ${String(limit / 1024)} KB), ${String(files.length)} files`,
  );
}

const lazy = readdirSync(join(dist, 'assets')).filter(
  (f) => /-specimen|many-to-one|not-found/.test(f) && f.endsWith('.js'),
);
console.log(
  `     lazy sample chunks (not initial): ${String(lazy.length)}, ${(lazy.reduce((n, f) => n + gz(join(dist, 'assets', f)), 0) / 1024).toFixed(1)} KB gzip total`,
);

const all = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'));
for (const f of all) {
  const code = readFileSync(join(dist, 'assets', f), 'utf8');
  if (/getContext\(\s*["'`]webgl/i.test(code) || /WebGLRenderingContext|THREE\./.test(code)) {
    failed = true;
    console.log(`FAIL ${f} contains WebGL code (DESIGN.md: CSS/SVG only)`);
  }
}
console.log(`ok   no WebGL, no 3D assets (limit ${String(LIMIT_POSTER_FREE)} bytes)`);

process.exit(failed ? 1 : 0);
