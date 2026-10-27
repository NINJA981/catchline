// Vitest setup: reset the in-memory fake browser between tests (WXT testing docs).
import { beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

beforeEach(() => {
  fakeBrowser.reset();
});
