// ADR 0001 section 6: bundle budgets for the built Chrome extension, gzip -6.
//
//   node scripts/check-size.mjs [outputDir]     (default .output/chrome-mv3; build first: pnpm build)
//
// Each bundle has a TARGET (the ADR budget) and a CEILING. Over the ceiling fails the build. Over the
// target but under the ceiling passes with a warning: the ceiling is a ratchet set at the size the
// bundle had when this check was added, so it can only be lowered, never quietly grown. Lower a
// ceiling in the same commit that makes a bundle smaller.
//
// A page entry (popup, options) counts everything its HTML loads before first paint: the entry
// module, the chunks it preloads and its stylesheets. The content scripts are single files.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(process.argv[2] ?? '.output/chrome-mv3');
const KB = 1024;

const BUDGETS = [
  {
    name: 'scanner content script (every page)',
    files: ['content-scripts/scanner.js'],
    target: 22,
    ceiling: 29,
  },
  {
    name: 'overlay content script (on demand)',
    files: ['content-scripts/overlay.js'],
    target: 95,
    ceiling: 140,
  },
  { name: 'popup entry', page: 'popup.html', target: 90, ceiling: 142 },
  { name: 'options entry', page: 'options.html', target: 110, ceiling: 141 },
];

function gz(file) {
  return gzipSync(readFileSync(file), { level: 6 }).length;
}

/** Files a built HTML page loads up front: scripts, modulepreloads and stylesheets. */
function pageFiles(htmlName) {
  const htmlPath = join(root, htmlName);
  const html = readFileSync(htmlPath, 'utf8');
  const out = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    out.add(resolve(root, m[1].replace(/^\//, '')));
  }
  return [...out];
}

let failed = false;
const rows = [];
for (const b of BUDGETS) {
  let files;
  try {
    files = b.page ? pageFiles(b.page) : b.files.map((f) => join(root, f));
  } catch {
    console.error(
      `check-size: ${root} is missing ${b.page ?? b.files.join(', ')}. Run "pnpm build" first.`,
    );
    process.exit(2);
  }
  const bytes = files.reduce((n, f) => n + gz(f), 0);
  const kb = bytes / KB;
  const status = kb > b.ceiling ? 'FAIL' : kb > b.target ? 'over target' : 'ok';
  if (status === 'FAIL') failed = true;
  rows.push(
    `${status.padEnd(11)} ${kb.toFixed(1).padStart(6)} kB  target ${String(b.target).padStart(3)}  ceiling ${String(b.ceiling).padStart(3)}  ${b.name}`,
  );
}

console.log(`check-size: gzip -6 sizes in ${root}`);
for (const r of rows) console.log(`  ${r}`);
if (failed) {
  console.error('check-size: a bundle is over its ceiling (see ADR 0001 section 6).');
  process.exit(1);
}
console.log('check-size: no bundle is over its ceiling.');
