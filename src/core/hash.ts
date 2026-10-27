// Small, dependency-free hashing for stable IDs. Not cryptographic; IDs never leave the device.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** 32-bit FNV-1a over UTF-16 code units, returned as an unsigned integer. */
export function fnv1a(input: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** Short, URL-safe ID: 'm' + base36 hash. Prefix lets IDs be used as DOM ids. */
export function shortId(prefix: string, input: string): string {
  return prefix + fnv1a(input).toString(36).padStart(7, '0');
}

/**
 * A DOM path that survives class churn: tag names with nth-of-type indexes from the root.
 * Example: "html>body>main:1>section:2>p:3".
 */
export function domPath(el: Element): string {
  const parts: string[] = [];
  let node: Element = el;
  for (;;) {
    const parent: Element | null = node.parentElement;
    const tag = node.tagName.toLowerCase();
    if (!parent) {
      parts.push(tag);
      break;
    }
    let index = 1;
    let sib = node.previousElementSibling;
    while (sib) {
      if (sib.tagName === node.tagName) index++;
      sib = sib.previousElementSibling;
    }
    parts.push(`${tag}:${index}`);
    node = parent;
  }
  return parts.reverse().join('>');
}
