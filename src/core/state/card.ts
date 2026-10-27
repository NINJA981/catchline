// Card state and copy for a catch (DESIGN.md "Catch card" states). Pure.

import { confidenceLevel } from '../match/score';
import type { Catch, MarkerGlyph } from '../types';

export type CardState =
  | { kind: 'matched'; tag: 'Matched' }
  | { kind: 'likely'; tag: 'Likely match'; reason: string }
  | { kind: 'many-to-one'; tag: 'Matched' | 'Likely match'; reason: string | null }
  | { kind: 'external'; href: string; host: string; copy: string }
  | { kind: 'not-found'; copy: string };

/** The marker as the page prints it, for copy: "*", "†", "¹", "3", "Terms apply". */
export function glyphDisplay(glyph: MarkerGlyph): string {
  if (glyph.startsWith('sup:')) return glyph.slice(4);
  if (glyph.startsWith('uni:')) {
    const map = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    // Digits only (ASCII), so a per-character replace is safe.
    return glyph.slice(4).replace(/\d/g, (d) => map.charAt(Number(d)));
  }
  if (glyph === 'phrase') return 'note';
  return glyph;
}

export function cardState(c: Catch): CardState {
  const { match, marker } = c;
  if (!match.footnoteId) {
    if (match.external) {
      const path = safePath(match.external.href);
      return {
        kind: 'external',
        href: match.external.href,
        host: match.external.host,
        copy: `Terms are on another page: ${match.external.host}${path}`,
      };
    }
    return {
      kind: 'not-found',
      copy: `No footnote found for this ${glyphDisplay(marker.glyph)}. The terms may be in an image or on another page.`,
    };
  }
  const level = confidenceLevel(match.confidence, true);
  const manyToOne = match.signals.some((s) => s.startsWith('many-to-one:'));
  const reason = level === 'likely' ? likelyReason(c) : null;
  if (manyToOne) {
    return { kind: 'many-to-one', tag: level === 'matched' ? 'Matched' : 'Likely match', reason };
  }
  if (level === 'matched') return { kind: 'matched', tag: 'Matched' };
  return { kind: 'likely', tag: 'Likely match', reason: reason ?? 'Likely match.' };
}

function safePath(href: string): string {
  try {
    const u = new URL(href);
    return u.pathname === '/' ? '' : u.pathname;
  } catch {
    return '';
  }
}

/**
 * Signals in words, for the "Likely match" tooltip:
 * "Likely match. Same † symbol in the page's legal section, 2 candidates."
 */
export function likelyReason(c: Catch): string {
  const s = c.match.signals;
  const parts: string[] = [];
  const glyph = glyphDisplay(c.marker.glyph);
  if (s.includes('same-glyph-block-start')) {
    const where = s.includes('legal-container')
      ? " in the page's legal section"
      : s.includes('small-font')
        ? ' in small print'
        : '';
    parts.push(`Same ${glyph} symbol${where}`);
  } else if (s.includes('phrase-legal-section')) {
    parts.push('Nearest legal section on the page');
  }
  const crowd = s.find((x) => x.startsWith('candidates:'));
  if (crowd) parts.push(`${crowd.slice('candidates:'.length)} candidates`);
  if (s.includes('hidden-text')) parts.push('found in collapsed text');
  return parts.length ? `Likely match. ${parts.join(', ')}.` : 'Likely match.';
}

/** Chips beyond the sixth collapse to "+N more" (DESIGN.md chip rules). */
export const MAX_VISIBLE_CHIPS = 6;

export function visibleChips<T>(
  chips: readonly T[],
  expanded: boolean,
): { shown: T[]; more: number } {
  if (expanded || chips.length <= MAX_VISIBLE_CHIPS) return { shown: [...chips], more: 0 };
  return { shown: chips.slice(0, MAX_VISIBLE_CHIPS), more: chips.length - MAX_VISIBLE_CHIPS };
}
