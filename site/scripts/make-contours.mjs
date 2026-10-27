// Generates public/contours.svg: the static T16 contour backdrop (DESIGN.md, Landing Page 3D plan).
// Deterministic (no randomness), marching squares over a smooth field, chained into polylines.
// The SVG is used as a CSS mask, so only its alpha matters. Run: node scripts/make-contours.mjs

import { writeFileSync } from 'node:fs';

const W = 960;
const H = 640;
const COLS = 80;
const ROWS = 54;
const LEVELS = 13;

// Smooth field: a few offset sine waves. Deterministic and cheap.
function field(x, y) {
  const u = x / W;
  const v = y / H;
  return (
    Math.sin(u * 5.1 + 0.6) * 0.5 +
    Math.sin(v * 6.3 - 1.1 + u * 2.2) * 0.45 +
    Math.sin((u + v) * 7.4 + 2.0) * 0.28 +
    Math.sin(u * 11.7 - v * 4.1 + 0.4) * 0.14
  );
}

const grid = [];
let lo = Infinity;
let hi = -Infinity;
for (let j = 0; j <= ROWS; j++) {
  const row = [];
  for (let i = 0; i <= COLS; i++) {
    const val = field((i / COLS) * W, (j / ROWS) * H);
    row.push(val);
    lo = Math.min(lo, val);
    hi = Math.max(hi, val);
  }
  grid.push(row);
}

const px = (i) => (i / COLS) * W;
const py = (j) => (j / ROWS) * H;
const lerp = (a, b, t) => a + (b - a) * t;

function segmentsFor(level) {
  const segs = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i + 1];
      const d = grid[j + 1][i];
      const idx =
        (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const top = [lerp(px(i), px(i + 1), (level - a) / (b - a)), py(j)];
      const right = [px(i + 1), lerp(py(j), py(j + 1), (level - b) / (c - b))];
      const bottom = [lerp(px(i), px(i + 1), (level - d) / (c - d)), py(j + 1)];
      const left = [px(i), lerp(py(j), py(j + 1), (level - a) / (d - a))];
      const table = {
        1: [[left, bottom]],
        2: [[bottom, right]],
        3: [[left, right]],
        4: [[top, right]],
        5: [
          [left, top],
          [bottom, right],
        ],
        6: [[top, bottom]],
        7: [[left, top]],
        8: [[left, top]],
        9: [[top, bottom]],
        10: [
          [left, bottom],
          [top, right],
        ],
        11: [[top, right]],
        12: [[left, right]],
        13: [[bottom, right]],
        14: [[left, bottom]],
      };
      for (const s of table[idx] ?? []) segs.push(s);
    }
  }
  return segs;
}

const key = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;

function chain(segs) {
  const byEnd = new Map();
  segs.forEach((s, n) => {
    for (const p of s) {
      const k = key(p);
      if (!byEnd.has(k)) byEnd.set(k, []);
      byEnd.get(k).push(n);
    }
  });
  const used = new Set();
  const lines = [];
  for (let n = 0; n < segs.length; n++) {
    if (used.has(n)) continue;
    used.add(n);
    const line = [segs[n][0], segs[n][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const end = dir ? line[line.length - 1] : line[0];
        const next = (byEnd.get(key(end)) ?? []).find((m) => !used.has(m));
        if (next === undefined) break;
        used.add(next);
        const [p, q] = segs[next];
        const far = key(p) === key(end) ? q : p;
        if (dir) line.push(far);
        else line.unshift(far);
      }
    }
    lines.push(line);
  }
  return lines;
}

let d = '';
for (let n = 1; n <= LEVELS; n++) {
  const level = lerp(lo, hi, n / (LEVELS + 1));
  for (const line of chain(segmentsFor(level))) {
    d += 'M' + line.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><path d="${d}" fill="none" stroke="#000" stroke-width="1.25" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>\n`;
writeFileSync(new URL('../public/contours.svg', import.meta.url), svg);
console.log(`contours.svg ${(svg.length / 1024).toFixed(1)} KB`);
