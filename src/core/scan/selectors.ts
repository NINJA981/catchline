// Selectors shared by the scanner and the matcher (ADR 0001 §4).

/** Subtrees that never contain claim markers: code, math, form controls, our own UI. */
export const EXCLUDED_SUBTREE_SELECTOR = [
  'code',
  'pre',
  'kbd',
  'samp',
  'var',
  'math',
  'script',
  'style',
  'noscript',
  'template',
  'textarea',
  'select',
  'svg',
  '.katex',
  '.katex-display',
  '.MathJax',
  '.MathJax_Display',
  'mjx-container',
  '[data-catchline]',
].join(',');

/**
 * Containers that hold fine print. Stage B searches inside them; the scanner does not treat
 * glyphs inside the narrower FINE_PRINT_SELECTOR as claims.
 */
export const LEGAL_CONTAINER_SELECTOR = [
  'footer',
  // Substrings are matched case-insensitively, so words that merely contain them are excluded:
  // "paralegal" is not legal, "refined" or "define" is not fine print (code review r1, finding 9).
  '[class*="legal" i]:not([class*="paralegal" i])',
  '[class*="disclaimer" i]',
  '[class*="terms" i]',
  '[id*="terms" i]',
  '[id*="legal" i]',
  '[id*="disclaimer" i]',
  '[class*="fine-print" i]',
  '[class*="fineprint" i]',
  '[class*="fine_print" i]',
  '[class*="disclosure" i]',
  '[id*="disclosure" i]',
  '[class*="offer-details" i]',
  '[id*="offer-details" i]',
  '[class*="footnote" i]',
  '[id*="footnote" i]',
  '[class*="asterisk" i]',
  '[role="contentinfo"]',
].join(',');

/** Narrow set: text inside these is fine print, never a claim. */
export const FINE_PRINT_SELECTOR = [
  'footer',
  '[role="contentinfo"]',
  '[class*="legal" i]:not([class*="paralegal" i])',
  '[class*="disclaimer" i]',
  '[class*="disclosure" i]',
  '[class*="fine-print" i]',
  '[class*="fineprint" i]',
  '[class*="fine_print" i]',
  '[class*="footnote" i]',
  '[id*="footnote" i]',
].join(',');

/** Wikipedia-style reference lists: always references, never commerce terms. */
export const REFERENCE_LIST_SELECTOR = [
  '.references',
  '.reflist',
  '.mw-references-wrap',
  '[class*="citation" i]',
].join(',');

/**
 * Generic note lists (blog endnotes, `ol.footnotes`). Commerce pages use them too, so a footnote
 * here is a plain reference only when it yields no term chips.
 */
export const NOTE_LIST_SELECTOR = [
  'ol.footnotes',
  '.footnotes ol',
  'section.footnotes',
  '[role="doc-endnotes"]',
].join(',');

/** Inline formatting elements; the claim block is the first ancestor that is not one of these. */
export const INLINE_TAGS = new Set([
  'A',
  'BUTTON',
  'LABEL',
  'ABBR',
  'B',
  'BDI',
  'BDO',
  'CITE',
  'DATA',
  'DEL',
  'DFN',
  'EM',
  'FONT',
  'I',
  'INS',
  'MARK',
  'Q',
  'S',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
  'BIG',
]);
