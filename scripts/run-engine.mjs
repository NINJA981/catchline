#!/usr/bin/env node
// Runs the Catchline engine (src/core) on one saved HTML page in Node and prints what it found as
// JSON: every marker, the footnote it matched, the confidence and the cost chips. No browser, no
// build, no network: the page is parsed by happy-dom with scripts and external resources disabled.
//
//   node scripts/run-engine.mjs tests/fixtures/synthetic/carrier-specimen.html
//   node scripts/run-engine.mjs page.html --all      (also list markers that are not counted)
//
// Font sizes come from inline `style="font-size: ..."` only (createInlineStyleOracle), so a page
// saved from a browser should have its computed font sizes inlined for the small-print signal to
// work, as the synthetic fixtures do. In the extension the real computed styles are used.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import { runnerImport } from 'vite';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const showAll = args.includes('--all');
if (!file) {
  console.error('usage: node scripts/run-engine.mjs <page.html> [--all]');
  process.exit(2);
}

const ROOT = resolve(import.meta.dirname, '..');
const { module: core } = await runnerImport(resolve(ROOT, 'src/core/index.ts'), {
  root: ROOT,
  configFile: false,
  logLevel: 'silent',
});

const html = readFileSync(resolve(file), 'utf8');
const win = new Window({
  url: 'https://fixture.example/',
  settings: {
    disableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    disableIframePageLoading: true,
  },
});
const doc = new win.DOMParser().parseFromString(html, 'text/html');

const family = core.guessFamily(doc.body.textContent).family;
const analysis = core.analyze(doc, core.createInlineStyleOracle(), { family });
const rollup = core.buildRollup(0, analysis.catches, Date.now());

function footnoteText(c) {
  const fn = c.match.footnoteId ? analysis.footnotes.get(c.match.footnoteId) : undefined;
  if (!fn) return null;
  const { sentence } = c.match;
  return sentence ? fn.block.text.slice(sentence.start, sentence.end) : fn.body;
}

const catches = analysis.catches
  .filter((c) => showAll || c.counted)
  .map((c) => ({
    marker: c.marker.glyph,
    claim: c.marker.claimText,
    counted: c.counted,
    reference: c.reference,
    confidence: Math.round(c.match.confidence * 100) / 100,
    footnote: footnoteText(c),
    termsElsewhere: c.match.external?.href ?? null,
    chips: c.chips.map((chip) => ({ kind: chip.kind, label: chip.label })),
    signals: c.match.signals,
  }));

console.log(
  JSON.stringify(
    {
      file,
      family,
      summary: core.rollupSummary(rollup),
      markers: analysis.catches.length,
      catches,
    },
    null,
    2,
  ),
);
await win.happyDOM.close();
