import { fireEvent, render, screen } from '@testing-library/react';
import {
  buildRollup,
  orderSummaries,
  toCatchSummary,
  type CatchSummary,
  type PopupInput,
} from '../../src/core';
import { App } from '../../src/entrypoints/popup/App';
import type { PopupModel } from '../../src/entrypoints/popup/usePopupInput';
import { analyzeFixture } from './helpers';

let input: PopupInput;
let catches: CatchSummary[] = [];
const spies = {
  toggleSite: vi.fn(),
  showAll: vi.fn(),
  reveal: vi.fn(),
  allowAllSites: vi.fn(),
  reloadPage: vi.fn(),
  openOptions: vi.fn(),
  openWelcome: vi.fn(),
};

vi.mock('../../src/entrypoints/popup/usePopupInput', () => ({
  usePopup: (): PopupModel => ({
    input,
    catches,
    host: 'carrier.example',
    enabledOnSite: !input.disabledHosts.includes('carrier.example'),
    theme: 'system',
    motion: 'system',
    ...spies,
  }),
}));

const analysis = analyzeFixture('synthetic/carrier-specimen.html');
const carrier = analysis.catches;

function base(patch: Partial<PopupInput> = {}): PopupInput {
  return {
    url: 'https://carrier.example/plans',
    disabledHosts: [],
    hasHostPermission: true,
    rollup: buildRollup(1, carrier, 0),
    scannerError: false,
    elapsedMs: 500,
    ready: true,
    ...patch,
  };
}

beforeEach(() => {
  Object.values(spies).forEach((s) => s.mockReset());
  catches = orderSummaries(carrier.map(toCatchSummary));
});

describe('popup (AC-F10.2 states)', () => {
  it('shows the count, the rollup line and the ledger for a page with catches', () => {
    input = base();
    render(<App />);
    expect(screen.getByRole('heading', { name: '3 catches: $35 + 36 months hidden' })).toBeTruthy();
    expect(screen.getByText('hidden', { exact: false })).toBeTruthy();
    // One term per row, categories in the label column.
    expect(screen.getByText('Money')).toBeTruthy();
    expect(screen.getByText('Time')).toBeTruthy();
    expect(screen.getAllByText('Requirements').length).toBeGreaterThan(0);
  });

  it('sets figures in the mono face', () => {
    input = base();
    const { container } = render(<App />);
    const figs = Array.from(container.querySelectorAll('.cl-fig')).map((e) => e.textContent);
    expect(figs).toContain('$35');
    expect(figs).toContain('36');
  });

  it('lists the catches with confidence in words', () => {
    input = base();
    render(<App />);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3);
    expect(screen.getAllByText('Matched').length).toBeGreaterThan(0);
  });

  it('reveals a catch with Enter and moves with the arrow keys', () => {
    input = base();
    render(<App />);
    const list = screen.getByRole('listbox', { name: 'Catches on this page' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(spies.reveal).toHaveBeenCalledWith(catches[1]?.id);
  });

  it('opens Show all from the primary button and from the A key', () => {
    input = base();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Show all on page/ }));
    expect(spies.showAll).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'a' });
    expect(spies.showAll).toHaveBeenCalledTimes(2);
  });

  it('shows the shortcut as keycaps', () => {
    input = base();
    const { container } = render(<App />);
    const keys = Array.from(container.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(keys).toEqual(['Alt', 'Shift', 'C']);
  });

  it('toggles the site from the header', () => {
    input = base();
    render(<App />);
    fireEvent.click(screen.getByRole('switch', { name: 'Catchline on carrier.example' }));
    expect(spies.toggleSite).toHaveBeenCalledWith(false);
  });

  it('announces changes politely', () => {
    input = base();
    const { container } = render(<App />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('shows nothing before the first read, then a skeleton after the delay', () => {
    input = base({ rollup: null, elapsedMs: 0, ready: false });
    const { unmount, container } = render(<App />);
    expect(screen.queryByLabelText('Scanning this page')).toBeNull();
    // No wrong state flashes in before the tab is known.
    expect(container.textContent).not.toMatch(/Browsers don't let/);
    unmount();
    input = base({ rollup: null, elapsedMs: 150, ready: false });
    render(<App />);
    expect(screen.getByLabelText('Scanning this page')).toBeTruthy();
  });

  it.each([
    ['restricted', { url: 'chrome://extensions' }, "Browsers don't let extensions read this page."],
    [
      'permission',
      { hasHostPermission: false },
      'Catchline needs permission to read pages to find fine print.',
    ],
    [
      'disabled',
      { disabledHosts: ['carrier.example'] },
      'Catchline is off on carrier.example. Turn it on to scan this page.',
    ],
    [
      'error',
      { scannerError: true, rollup: null },
      "Catchline can't reach this page yet. Reload the page to scan it.",
    ],
  ] as const)('shows the %s state copy', (_name, patch, copy) => {
    input = base(patch);
    render(<App />);
    expect(screen.getByText(copy)).toBeTruthy();
  });

  it('has exactly one page heading in every state (axe page-has-heading-one)', () => {
    const states: [string, Partial<PopupInput>][] = [
      ['with catches', {}],
      ['empty', { rollup: buildRollup(1, [], 0) }],
      ['restricted', { url: 'chrome://extensions' }],
      ['permission', { hasHostPermission: false }],
      ['disabled', { disabledHosts: ['carrier.example'] }],
      ['error', { scannerError: true, rollup: null }],
      ['loading', { rollup: null, elapsedMs: 150, ready: false }],
    ];
    for (const [name, patch] of states) {
      input = base(patch);
      if (name === 'empty') catches = [];
      const { unmount } = render(<App />);
      expect(screen.getAllByRole('heading', { level: 1 }).length, name).toBe(1);
      unmount();
      catches = orderSummaries(carrier.map(toCatchSummary));
    }
  });

  it('gives each failure state its action', () => {
    input = base({ hasHostPermission: false });
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Allow on all sites' }));
    expect(spies.allowAllSites).toHaveBeenCalled();
    unmount();
    input = base({ scannerError: true, rollup: null });
    const second = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(spies.reloadPage).toHaveBeenCalled();
    second.unmount();
    input = base({ disabledHosts: ['carrier.example'] });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on for carrier.example' }));
    expect(spies.toggleSite).toHaveBeenCalledWith(true);
  });

  it('shows the empty state with the badge explanation and the welcome action', () => {
    input = base({ rollup: buildRollup(1, [], 0) });
    catches = [];
    render(<App />);
    expect(screen.getByText(/No fine print on this page\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open welcome page' }));
    expect(spies.openWelcome).toHaveBeenCalled();
  });

  it('shows reference-only pages as 0 catches with the footnotes listed', () => {
    const refs = analyzeFixture('synthetic/reference-footnotes.html').catches;
    input = base({ rollup: buildRollup(1, refs, 0) });
    catches = orderSummaries(refs.map(toCatchSummary));
    render(<App />);
    expect(screen.getByRole('heading', { name: /0 catches/ })).toBeTruthy();
    expect(
      screen.getByText("These footnotes don't mention fees, terms or conditions."),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Other footnotes \(\d+\)/ })).toBeTruthy();
  });

  it('has a footer with Options and no Show all when there are no catches', () => {
    input = base({ rollup: buildRollup(1, [], 0) });
    catches = [];
    render(<App />);
    expect(screen.queryByRole('button', { name: /Show all on page/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(spies.openOptions).toHaveBeenCalled();
  });

  it('uses no fake data: it prints only what the scan found', () => {
    input = base();
    const { container } = render(<App />);
    expect(container.textContent).not.toMatch(/lorem|ipsum|testimonial|stars?\b/i);
  });
});
