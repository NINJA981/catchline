// Claim text: the sentence, heading or price block that a marker qualifies (SPEC F1).

import { collapseWhitespace, splitSentences, truncate } from '../text';
import { INLINE_TAGS } from './selectors';

export const CLAIM_MAX_CHARS = 200;

/** The first ancestor of `node` that is not an inline formatting element. */
export function claimBlockFor(node: Node): Element | null {
  let el: Element | null = node instanceof Element ? node : node.parentElement;
  while (el && INLINE_TAGS.has(el.tagName) && el.parentElement) {
    // A link that is itself a block-like card stays a claim block only if it has no block parent.
    el = el.parentElement;
  }
  return el;
}

/** Character offset of `target` within `block`'s raw textContent. */
export function textOffsetWithin(block: Element, target: Node, targetOffset = 0): number {
  let offset = 0;
  const stack: Node[] = [block];
  while (stack.length) {
    const node = stack.pop();
    if (!node) break;
    if (node === target) return offset + targetOffset;
    if (node.nodeType === 3) {
      offset += (node as Text).data.length;
      continue;
    }
    if (node.contains(target)) {
      // Descend in order: push children reversed so the first child is processed first.
      const kids = node.childNodes;
      for (let i = kids.length - 1; i >= 0; i--) {
        const kid = kids[i];
        if (kid) stack.push(kid);
      }
    } else {
      offset += node.textContent?.length ?? 0;
    }
  }
  return offset;
}

/**
 * Claim text for a marker located at `offset` within `block`. Short blocks are used whole;
 * long blocks are narrowed to the sentence that contains the marker.
 */
export function claimTextAt(block: Element, offset: number): string {
  const raw = block.textContent;
  const whole = collapseWhitespace(raw);
  if (whole.length <= CLAIM_MAX_CHARS) return whole;
  const sentences = splitSentences(raw);
  // The marker sits right after the claim it qualifies, possibly after the sentence's period.
  const hit =
    sentences.find((s) => offset >= s.start && offset <= s.end) ??
    [...sentences].reverse().find((s) => s.start <= offset);
  const text = collapseWhitespace(hit?.text ?? raw);
  return truncate(text, CLAIM_MAX_CHARS);
}
