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

const registered = new WeakMap<Document, { faces: FontFace[]; refs: number }>();

/**
 * Registers the private families on the host document and returns a function that removes them.
 *
 * The FontFace API is preferred: the extension URL then lives only inside the browser and is never
 * written into page-readable CSS text, so a page script cannot read a per-install Firefox UUID
 * (code review fix round 1). Environments without FontFace fall back to one <style> element, which
 * the returned function removes.
 */
export function registerFonts(doc: Document, urlFor: (path: string) => string): () => void {
  const fdoc = { fonts: (doc as { fonts?: FontFaceSet }).fonts };
  if (typeof FontFace === 'function' && fdoc.fonts) {
    let entry = registered.get(doc);
    if (!entry) {
      const faces = [
        new FontFace(
          'Catchline Schibsted',
          `url("${urlFor(FONT_FILES.schibsted)}") format("woff2-variations")`,
          {
            style: 'normal',
            weight: '400 900',
            display: 'swap',
          },
        ),
        new FontFace('Catchline Commit', `url("${urlFor(FONT_FILES.commit400)}") format("woff2")`, {
          style: 'normal',
          weight: '400',
          display: 'swap',
        }),
        new FontFace('Catchline Commit', `url("${urlFor(FONT_FILES.commit500)}") format("woff2")`, {
          style: 'normal',
          weight: '500',
          display: 'swap',
        }),
      ];
      for (const f of faces) {
        fdoc.fonts.add(f);
        // Failures (a page CSP blocking font-src) fall back to system fonts; nothing to report.
        f.load().catch(() => undefined);
      }
      entry = { faces, refs: 0 };
      registered.set(doc, entry);
    }
    entry.refs += 1;
    const owned = entry;
    return () => {
      owned.refs -= 1;
      if (owned.refs > 0) return;
      for (const f of owned.faces) fdoc.fonts?.delete(f);
      registered.delete(doc);
    };
  }
  let style = doc.getElementById(FONT_STYLE_ID) as HTMLStyleElement | null;
  if (style?.tagName !== 'STYLE') {
    style = doc.createElement('style');
    style.id = FONT_STYLE_ID;
    style.setAttribute('data-catchline', '');
    style.textContent = fontFaceCss(urlFor);
    ((doc.head as HTMLHeadElement | null) ?? doc.documentElement).appendChild(style);
  }
  const el = style;
  return () => {
    el.remove();
  };
}
