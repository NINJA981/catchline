// Turns what the visitor pasted into a Document the engine can scan. DOMParser documents are
// inert: no script runs, no image or stylesheet is fetched, nothing is attached to the page.

export const MAX_INPUT_CHARS = 2_000_000;

export type InputErrorKind = 'empty' | 'too-large' | 'unreadable';

export class InputError extends Error {
  readonly kind: InputErrorKind;
  constructor(kind: InputErrorKind, message: string) {
    super(message);
    this.name = 'InputError';
    this.kind = kind;
  }
}

export interface ParsedInput {
  doc: Document;
  kind: 'html' | 'text';
}

/** True when the text looks like markup rather than a pasted paragraph. */
export function looksLikeHtml(raw: string): boolean {
  return /<(?:!doctype|\/?(?:html|head|body|div|p|span|section|article|footer|main|header|h[1-6]|ul|ol|li|sup|small|details|table|a|br))\b/i.test(
    raw,
  );
}

export function parseInput(raw: string): ParsedInput {
  if (!raw.trim()) {
    throw new InputError(
      'empty',
      'Nothing to scan. Paste some text or page HTML, or try a sample.',
    );
  }
  if (raw.length > MAX_INPUT_CHARS) {
    throw new InputError(
      'too-large',
      'That is more than 2 million characters. Paste only the part of the page with the offer and its fine print.',
    );
  }
  try {
    const parser = new DOMParser();
    if (looksLikeHtml(raw)) {
      return { doc: parser.parseFromString(raw, 'text/html'), kind: 'html' };
    }
    // Plain text: one paragraph per line, built with textContent so nothing is parsed as markup.
    const doc = parser.parseFromString('<!doctype html><html><body></body></html>', 'text/html');
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const p = doc.createElement('p');
      p.textContent = line.trim();
      doc.body.appendChild(p);
    }
    return { doc, kind: 'text' };
  } catch {
    throw new InputError(
      'unreadable',
      "Catchline couldn't read that. Try pasting the text of the page instead.",
    );
  }
}
