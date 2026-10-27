// Vitest setup: reset the in-memory fake browser between tests (WXT testing docs).
import { beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

beforeEach(() => {
  fakeBrowser.reset();
});

// happy-dom rejects Animation.finished on cancel() without marking it handled (browsers do), which
// Motion triggers on unmount. Mark it handled so a cancelled animation is not an unhandled rejection.
const nativeAnimate: Element['animate'] | undefined =
  typeof Element === 'undefined'
    ? undefined
    : // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with .apply below
      Element.prototype.animate;
if (nativeAnimate) {
  Element.prototype.animate = function patched(
    this: Element,
    ...args: Parameters<Element['animate']>
  ) {
    const a = nativeAnimate.apply(this, args);
    a.finished.catch(() => undefined);
    return a;
  };
}
