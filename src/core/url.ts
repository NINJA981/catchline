// URL helpers for restricted pages and per-site settings. Hostnames only; full URLs are never stored.

const RESTRICTED_SCHEMES = [
  'chrome:',
  'chrome-extension:',
  'chrome-untrusted:',
  'devtools:',
  'edge:',
  'brave:',
  'opera:',
  'vivaldi:',
  'about:',
  'moz-extension:',
  'resource:',
  'view-source:',
  'data:',
  'javascript:',
];

const STORE_HOSTS = [
  'chromewebstore.google.com',
  'chrome.google.com', // /webstore paths
  'microsoftedge.microsoft.com',
  'addons.mozilla.org',
  'addons.opera.com',
];

/** Pages browsers don't let extensions read (DESIGN.md popup "Restricted" state). */
export function isRestrictedUrl(url: string | undefined | null): boolean {
  if (!url) return true;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (RESTRICTED_SCHEMES.includes(u.protocol)) return true;
  if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'file:') return true;
  const host = u.hostname.toLowerCase();
  if (host === 'chrome.google.com') return u.pathname.startsWith('/webstore');
  if (STORE_HOSTS.includes(host)) return true;
  // Chrome's built-in PDF viewer runs under the extension scheme; a .pdf URL shows it.
  if (/\.pdf$/i.test(u.pathname)) return true;
  return false;
}

/** Lowercased hostname without a leading "www.", or null for non-web URLs. */
export function hostnameOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return normalizeHost(u.hostname);
  } catch {
    return null;
  }
}

/** "WWW.Example.com." -> "example.com". Accepts a hostname or a URL typed by the user. */
export function normalizeHost(input: string): string {
  let h = input.trim().toLowerCase();
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(h)) {
    try {
      h = new URL(h).hostname;
    } catch {
      // keep as typed
    }
  }
  h = h.replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/\.$/, '');
  return h.startsWith('www.') ? h.slice(4) : h;
}

/** True when `host` equals a disabled host or is a subdomain of one. */
export function isHostDisabled(host: string | null, disabledHosts: readonly string[]): boolean {
  if (!host) return false;
  const h = normalizeHost(host);
  return disabledHosts.some((d) => {
    const n = normalizeHost(d);
    return h === n || h.endsWith(`.${n}`);
  });
}

/** Middle truncation for hostnames in the popup header: "very-long-sub…example.com". */
export function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}
