import { render, screen } from '@testing-library/react';
import { buildRollup, type PopupInput } from '../../src/core';
import { App } from '../../src/entrypoints/popup/App';
import { analyzeFixture } from './helpers';

let input: PopupInput;

vi.mock('../../src/entrypoints/popup/usePopupInput', () => ({
  usePopupInput: () => input,
}));

const catches = analyzeFixture('synthetic/carrier-specimen.html').catches;

function base(patch: Partial<PopupInput> = {}): PopupInput {
  return {
    url: 'https://carrier.example/plans',
    disabledHosts: [],
    hasHostPermission: true,
    rollup: buildRollup(1, catches, 0),
    scannerError: false,
    elapsedMs: 500,
    ...patch,
  };
}

describe('popup placeholder (AC-F10.2 states)', () => {
  it('shows the rollup for a page with catches', () => {
    input = base();
    render(<App />);
    expect(screen.getByRole('heading', { name: '3 catches' })).toBeTruthy();
    expect(screen.getByText('3 catches: $35 + 36 months hidden')).toBeTruthy();
  });

  it('announces changes politely', () => {
    input = base();
    const { container } = render(<App />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('shows a skeleton after the delay and nothing before it', () => {
    input = base({ rollup: null, elapsedMs: 0 });
    const { unmount } = render(<App />);
    expect(screen.queryByLabelText('Scanning this page')).toBeNull();
    unmount();
    input = base({ rollup: null, elapsedMs: 150 });
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

  it('shows the empty state with the badge explanation', () => {
    input = base({ rollup: buildRollup(1, [], 0) });
    render(<App />);
    expect(screen.getByText(/No fine print on this page\./)).toBeTruthy();
  });

  it('shows reference-only pages as 0 catches', () => {
    const refs = analyzeFixture('synthetic/reference-footnotes.html').catches;
    input = base({ rollup: buildRollup(1, refs, 0) });
    render(<App />);
    expect(screen.getByRole('heading', { name: '0 catches' })).toBeTruthy();
    expect(
      screen.getByText("These footnotes don't mention fees, terms or conditions."),
    ).toBeTruthy();
  });

  it('uses no fake data: the placeholder prints only what the scan found', () => {
    input = base();
    const { container } = render(<App />);
    expect(container.textContent).not.toMatch(/lorem|ipsum|testimonial|stars?\b/i);
  });
});
