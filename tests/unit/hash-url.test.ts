import {
  domPath,
  fnv1a,
  hostnameOf,
  isHostDisabled,
  isRestrictedUrl,
  normalizeHost,
  shortId,
  truncateMiddle,
} from '../../src/core';
import { parse } from './helpers';

describe('hashing', () => {
  it('matches the FNV-1a reference vectors', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });

  it('is deterministic and unsigned', () => {
    expect(fnv1a('catchline')).toBe(fnv1a('catchline'));
    expect(fnv1a('catchline')).toBeGreaterThanOrEqual(0);
  });

  it('builds short ids that are safe as DOM ids', () => {
    const id = shortId('m', 'html>body>p:1|*|1');
    expect(id).toMatch(/^m[0-9a-z]{7,}$/);
    expect(shortId('m', 'x')).not.toBe(shortId('f', 'x'));
  });

  it('builds a DOM path with nth-of-type indexes', () => {
    const doc = parse('<body><main><p>a</p><p id="t">b</p><div><p>c</p></div></main></body>');
    expect(domPath(doc.getElementById('t') as Element)).toBe('html>body:1>main:1>p:2');
    expect(domPath(doc.querySelector('div p') as Element)).toBe('html>body:1>main:1>div:1>p:1');
  });
});

describe('isRestrictedUrl', () => {
  it.each([
    'chrome://extensions',
    'chrome-extension://abc/popup.html',
    'about:blank',
    'edge://settings',
    'moz-extension://abc/page.html',
    'view-source:https://example.com',
    'data:text/html,hi',
    'https://chromewebstore.google.com/detail/x',
    'https://chrome.google.com/webstore/detail/x',
    'https://addons.mozilla.org/en-US/firefox/',
    'https://example.com/brochure.pdf',
    'not a url',
    '',
  ])('restricts %s', (url) => {
    expect(isRestrictedUrl(url)).toBe(true);
  });

  it.each(['https://example.com/', 'http://localhost:3000/x', 'https://chrome.google.com/other'])(
    'allows %s',
    (url) => {
      expect(isRestrictedUrl(url)).toBe(false);
    },
  );

  it('restricts missing urls', () => {
    expect(isRestrictedUrl(null)).toBe(true);
    expect(isRestrictedUrl(undefined)).toBe(true);
  });
});

describe('hostnames', () => {
  it('normalizes hosts typed or pasted by the user', () => {
    expect(normalizeHost('WWW.Example.COM.')).toBe('example.com');
    expect(normalizeHost('https://www.example.com/path?q=1')).toBe('example.com');
    expect(normalizeHost('example.com:8080/x')).toBe('example.com');
    expect(normalizeHost('  shop.example.com  ')).toBe('shop.example.com');
  });

  it('extracts the hostname of web urls only', () => {
    expect(hostnameOf('https://www.example.com/a')).toBe('example.com');
    expect(hostnameOf('file:///tmp/x.html')).toBeNull();
    expect(hostnameOf('nope')).toBeNull();
    expect(hostnameOf(null)).toBeNull();
  });

  it('disables a host and its subdomains, nothing else', () => {
    const list = ['example.com'];
    expect(isHostDisabled('example.com', list)).toBe(true);
    expect(isHostDisabled('www.example.com', list)).toBe(true);
    expect(isHostDisabled('shop.example.com', list)).toBe(true);
    expect(isHostDisabled('notexample.com', list)).toBe(false);
    expect(isHostDisabled('example.com.evil.test', list)).toBe(false);
    expect(isHostDisabled(null, list)).toBe(false);
    expect(isHostDisabled('example.com', [])).toBe(false);
  });

  it('truncates the middle of long hostnames', () => {
    expect(truncateMiddle('example.com', 20)).toBe('example.com');
    const out = truncateMiddle('very-long-subdomain.example.com', 15);
    expect(out).toHaveLength(15);
    expect(out).toContain('…');
    expect(out.startsWith('very-lo')).toBe(true);
    expect(out.endsWith('ple.com')).toBe(true);
  });
});
