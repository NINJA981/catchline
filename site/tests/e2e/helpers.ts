import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

export const ORIGIN = 'http://localhost:4619';
export const BUILD_DIR = resolve(import.meta.dirname, '..', '..', '..', '.output', 'site');
export const FIXTURE_DIR = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'tests',
  'fixtures',
  'synthetic',
);

/** True in the phone project, where taps replace clicks. */
export function isPhone(): boolean {
  return test.info().project.name === 'phone';
}

/** Activates a control the way the project's user would: a tap on the phone, a click on desktop. */
export async function press(locator: Locator): Promise<void> {
  if (isPhone()) await locator.tap();
  else await locator.click();
}

/** Console errors, page errors and requests outside the page's own origin. */
export function watch(page: Page): { errors: string[]; foreign: string[] } {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== ORIGIN && !/^(data|blob):/.test(r.url())) foreign.push(r.url());
  });
  return { errors, foreign };
}

/** Every file in the production build, as a path relative to its root with forward slashes. */
export function buildFiles(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.add(relative(BUILD_DIR, full).split(sep).join('/'));
    }
  };
  walk(BUILD_DIR);
  return out;
}

/** The built file a same-origin URL is served from, or null if the build has no such file. */
export function servedFile(url: string, files: Set<string>): string | null {
  const path = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
  for (const candidate of [path, `${path}index.html`, `${path}/index.html`]) {
    if (candidate && files.has(candidate)) return candidate;
  }
  return path === '' && files.has('index.html') ? 'index.html' : null;
}

export async function waitForResult(page: Page): Promise<void> {
  await expect(page.locator('#result .result__summary, #result .panel')).toBeVisible();
}

export { expect, test };
export type { Page, Locator };
