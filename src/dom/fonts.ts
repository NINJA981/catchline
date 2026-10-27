// Document-level font registration (ADR §5.3). Chromium ignores @font-face inside shadow-root
// styles, so one <style> in the host <head> declares private family names that select nothing on
// the host page. The woff2 files are extension resources (web_accessible_resources), never a CDN.

export const FONT_STYLE_ID = 'catchline-fonts';

export const FONT_FILES = {
  schibsted: 'fonts/schibsted-grotesk-latin-wght-normal.woff2',
  commit400: 'fonts/commit-mono-latin-400-normal.woff2',
  commit500: 'fonts/commit-mono-latin-500-normal.woff2',
} as const;

export function fontFaceCss(urlFor: (path: string) => string): string {
  return [
    `@font-face{font-family:"Catchline Schibsted";font-style:normal;font-weight:400 900;font-display:swap;src:url("${urlFor(FONT_FILES.schibsted)}") format("woff2-variations")}`,
    `@font-face{font-family:"Catchline Commit";font-style:normal;font-weight:400;font-display:swap;src:url("${urlFor(FONT_FILES.commit400)}") format("woff2")}`,
    `@font-face{font-family:"Catchline Commit";font-style:normal;font-weight:500;font-display:swap;src:url("${urlFor(FONT_FILES.commit500)}") format("woff2")}`,
  ].join('\n');
}

/** Idempotent: a second call returns the existing element. */
export function registerFonts(doc: Document, urlFor: (path: string) => string): HTMLStyleElement {
  const existing = doc.getElementById(FONT_STYLE_ID);
  if (existing?.tagName === 'STYLE') return existing as HTMLStyleElement;
  const style = doc.createElement('style');
  style.id = FONT_STYLE_ID;
  style.setAttribute('data-catchline', '');
  style.textContent = fontFaceCss(urlFor);
  ((doc.head as HTMLHeadElement | null) ?? doc.documentElement).appendChild(style);
  return style;
}
