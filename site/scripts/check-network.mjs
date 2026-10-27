// Fails if the built site contains a network primitive or an external URL (SPEC 9: no network
// beyond the static assets). The only request code is the browser's own: page loads, the manifest
// and the service worker script, all same-origin.
//   node scripts/check-network.mjs   (after `pnpm build`)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../../.output/site');
const FORBIDDEN =
  /\bfetch\s*\(|XMLHttpRequest|new WebSocket|EventSource|sendBeacon|importScripts|navigator\.connection/;
// Allowed: SVG namespaces, and the fictional *.example hosts inside the bundled sample pages (data, never fetched).
const ALLOWED_URLS = /^https?:\/\/(?:www\.w3\.org\/\d{4}\/[\w/-]+|[\w.-]+\.example(?:[/:]|$))/;

let failed = false;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(js|html|css|webmanifest)$/.test(name)) check(full);
  }
}

function check(file) {
  const text = readFileSync(file, 'utf8');
  if (FORBIDDEN.test(text)) {
    failed = true;
    console.log(`FAIL ${file}: network primitive`);
  }
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
    if (!ALLOWED_URLS.test(m[0])) {
      failed = true;
      console.log(`FAIL ${file}: external URL ${m[0]}`);
    }
  }
}

walk(dist);
console.log(
  failed
    ? 'check:network FAILED'
    : 'ok   check:network: no network primitive and no external URL in the build',
);
process.exit(failed ? 1 : 0);
