// SPEC §9 / AC-X.2: Catchline makes no network requests. Fails when the built extension contains
// a network primitive, and when the manifest asks for anything that could phone home.
//
// Usage: node scripts/check-network.mjs [outputDir]   (default: .output/chrome-mv3)
// Build first: pnpm build

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? '.output/chrome-mv3';

const PRIMITIVES = [
  ['fetch(', /(?<![\w$.])fetch\s*\(/],
  ['window.fetch / globalThis.fetch', /(?:window|globalThis|self)\s*\.\s*fetch\b/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['importScripts of a URL', /importScripts\s*\(\s*["'`]https?:/],
  ['remote script/style tag', /<(?:script|link)[^>]+(?:src|href)=["']https?:\/\//i],
  ['remote CSS url()', /url\(\s*["']?https?:\/\//i],
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let files;
try {
  files = walk(root);
} catch {
  console.error(`check-network: ${root} not found. Run "pnpm build" first.`);
  process.exit(2);
}

const problems = [];
for (const file of files) {
  if (!/\.(js|mjs|html|css|json)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const [name, re] of PRIMITIVES) {
    if (re.test(text)) problems.push(`${relative(root, file)}: ${name}`);
  }
}

// The manifest must not open the door to remote code or remote pages.
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const csp = manifest.content_security_policy?.extension_pages ?? '';
if (!/script-src 'self'/.test(csp))
  problems.push("manifest: extension_pages CSP must set script-src 'self'");
if (/https?:|unsafe-eval|unsafe-inline/.test(csp))
  problems.push(`manifest: CSP allows remote or unsafe sources (${csp})`);
for (const perm of [...(manifest.permissions ?? []), ...(manifest.optional_permissions ?? [])]) {
  if (
    [
      'webRequest',
      'webRequestBlocking',
      'declarativeNetRequest',
      'history',
      'tabs',
      'cookies',
    ].includes(perm)
  ) {
    problems.push(`manifest: unexpected permission "${perm}"`);
  }
}
if (manifest.externally_connectable)
  problems.push('manifest: externally_connectable must not be set');

if (problems.length > 0) {
  console.error('check-network FAILED:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-network: ok (${files.length} files in ${root}, no network primitives)`);
