// The tether: SVG bezier from the claim marker to the card edge (DESIGN.md Tether). Geometry comes
// from the shared engine module; this file only draws it.

import { bezierPath, type Bezier } from '@catchline/core';
import { svgEl } from './dom';

export interface Tether {
  svg: SVGSVGElement;
  glow: SVGPathElement;
  line: SVGPathElement;
  dot: SVGCircleElement;
}

export function createTether(): Tether {
  const svg = svgEl('svg', { 'aria-hidden': 'true', focusable: 'false' });
  svg.setAttribute('class', 'tether');
  const glow = svgEl('path', { pathLength: 1 });
  glow.setAttribute('class', 'tether__glow');
  const line = svgEl('path', { pathLength: 1 });
  line.setAttribute('class', 'tether__line');
  const dot = svgEl('circle', { r: 2 });
  dot.setAttribute('class', 'tether__dot');
  svg.append(glow, line, dot);
  return { svg, glow, line, dot };
}

export function setTether(t: Tether, b: Bezier): void {
  const d = bezierPath(b);
  t.glow.setAttribute('d', d);
  t.line.setAttribute('d', d);
  t.dot.setAttribute('cx', String(b.p0.x));
  t.dot.setAttribute('cy', String(b.p0.y));
}

export function showTether(t: Tether, visible: boolean): void {
  t.svg.toggleAttribute('hidden', !visible);
}
