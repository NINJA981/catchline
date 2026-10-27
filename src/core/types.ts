// Domain types (SPEC §7). Pure data plus live element references held as WeakRef.
// Nothing in this file touches browser.* APIs.

export const FAMILIES = ['carrier', 'bank', 'retail', 'streaming', 'saas', 'travel'] as const;
export type Family = (typeof FAMILIES)[number];

export type SymbolGlyph = '*' | '**' | '†' | '††' | '‡' | '‡‡' | '§' | '¶';
export type MarkerGlyph = SymbolGlyph | `sup:${string}` | `uni:${string}` | 'phrase';

/** Where in a text node a glyph sits, so the overlay can measure it with a Range. */
export interface TextAnchor {
  node: WeakRef<Text>;
  start: number;
  end: number;
}

export interface Marker {
  /** Stable per scan: hash of DOM path + glyph + ordinal. */
  id: string;
  glyph: MarkerGlyph;
  /** Footnote key the matcher looks for at the start of a block ('*', '†', '3', 'a', 'phrase'). */
  key: string;
  /** The sentence or heading the marker qualifies, trimmed to 200 chars. */
  claimText: string;
  claimEl: WeakRef<Element>;
  /** null for markerless phrases. */
  markerEl: WeakRef<Element> | null;
  anchor: TextAnchor | null;
  family: Family | 'unknown';
  /** Document order of the marker among all markers. */
  ordinal: number;
}

/**
 * Why a block is a footnote candidate. 'block-start' (a block that starts with the marker glyph
 * outside any legal container or small type) extends SPEC §7's list.
 */
export type FootnoteSource =
  'linked' | 'legal-container' | 'small-font' | 'details' | 'hidden' | 'block-start';

export interface FootnoteBlock {
  id: string;
  /** Full textContent, whitespace-collapsed. */
  text: string;
  source: FootnoteSource;
  el: WeakRef<Element>;
  wordCount: number;
}

/**
 * Signals a match carries. Free-form strings with a few well-known prefixes:
 * 'href', 'aria-describedby', 'aria-details', 'same-glyph-block-start', 'legal-container',
 * 'small-font', 'below-claim', 'nearest-following', 'unique-candidate', 'candidates:N',
 * 'token-overlap:0.42', 'hidden-text', 'phrase-legal-section', 'many-to-one:N'.
 */
export type MatchSignal = string;

export interface Match {
  markerId: string;
  /** null = "No footnote found". */
  footnoteId: string | null;
  /** Span in FootnoteBlock.text chosen for many-to-one footnotes (F3). */
  sentence: { start: number; end: number } | null;
  /** 0..1 */
  confidence: number;
  signals: MatchSignal[];
  /** "Terms are on another page". */
  external?: { href: string; host: string };
}

export const CHIP_KINDS = ['money', 'time', 'rate', 'requirement', 'exclusion', 'renewal'] as const;
export type ChipKind = (typeof CHIP_KINDS)[number];

export interface Chip {
  kind: ChipKind;
  label: string;
  /** money: amount in currency units; time: months; rate: first percentage. */
  value?: number;
  /** money: ISO currency, optionally '/mo' or '/yr'; time: 'months'; rate: '%'. */
  unit?: string;
  /** Span in the text the chips were extracted from. */
  span: [number, number];
}

export interface Catch {
  marker: Marker;
  match: Match;
  chips: Chip[];
  /** Counts toward the toolbar badge (SPEC §3). */
  counted: boolean;
  /** Plain reference footnote (Wikipedia-style), listed under "Other footnotes". */
  reference: boolean;
}

export interface TabRollup {
  tabId: number;
  /** Badge number. */
  catches: number;
  /** Includes uncounted reference footnotes and unmatched markers. */
  listed: number;
  money: { total: number; currency: string; items: string[] };
  longestTerm: { months: number; label: string } | null;
  requirements: string[];
  /** Epoch ms. */
  scannedAt: number;
}

/**
 * Layout-dependent reads go through this interface so the core runs in happy-dom (no layout),
 * in the content script (getComputedStyle) and in the corpus scorer.
 */
export interface StyleOracle {
  /** Computed font size in px, or null when unknown. */
  fontSizePx(el: Element): number | null;
}
