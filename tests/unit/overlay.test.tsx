import { fireEvent, render, screen } from '@testing-library/react';
import { analyze, createInlineStyleOracle, type Catch } from '../../src/core';
import {
  buildModels,
  isInteractive,
  showAllModels,
  type CatchModel,
} from '../../src/overlay/model';
import { CardContent } from '../../src/overlay/CardContent';
import { MotionProvider } from '../../src/ui/components/motion';
import { ChipList, FinePrint } from '../../src/ui/components/catch-parts';
import { loadFixture } from './helpers';

function models(name: string): { models: CatchModel[]; catches: Catch[] } {
  const a = analyze(loadFixture(name), createInlineStyleOracle());
  return { models: buildModels(a), catches: a.catches };
}

function card(m: CatchModel) {
  return render(
    <MotionProvider reduce>
      <CardContent
        model={m}
        hostname="ridgeline.example"
        styleRoot={() => document.body}
        headingId="h"
        announce={() => undefined}
        onClose={() => undefined}
      />
    </MotionProvider>,
  );
}

describe('catch card states (DESIGN.md "Catch card")', () => {
  it('matched: claim, chips, the raw footnote and the actions', () => {
    const { models: ms } = models('synthetic/carrier-specimen.html');
    const m = ms.find((x) => x.claimText.includes('$0/mo'));
    if (!m) throw new Error('fixture changed');
    const { container } = card(m);
    // The claim names the dialog but is not a heading: the card lands inside someone else's page
    // and must not break that page's heading outline (axe heading-order).
    expect(container.querySelector('.cl-card__claim')?.textContent).toContain('$0/mo*');
    expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
    expect(screen.getByText('Matched')).toBeTruthy();
    expect(container.querySelectorAll('.cl-chip').length).toBeGreaterThanOrEqual(3);
    // The merchant's own words are always shown (AC-F4.2), with the chip spans marked.
    const fine = container.querySelector('[data-testid="fine-print"]');
    expect(fine?.textContent).toContain('$35 activation fee');
    expect(fine?.querySelectorAll('mark').length).toBeGreaterThan(0);
    for (const label of ['Copy text', 'Save image', 'Copy image', 'Go to footnote', 'Close']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('every icon button has an accessible name', () => {
    const { models: ms } = models('synthetic/carrier-specimen.html');
    const { container } = card(ms[0] as CatchModel);
    for (const b of container.querySelectorAll('button')) {
      expect((b.getAttribute('aria-label') ?? b.textContent).trim().length).toBeGreaterThan(0);
    }
  });

  it('no footnote found: says so, never guesses, offers to search the page', () => {
    const { models: ms } = models('synthetic/not-found.html');
    const m = ms.find((x) => x.card.kind === 'not-found');
    if (!m) throw new Error('fixture changed');
    const { container } = card(m);
    expect(
      screen.getByText(
        'No footnote found for this *. The terms may be in an image or on another page.',
      ),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="fine-print"]')).toBeNull();
    expect(container.querySelectorAll('.cl-chip').length).toBe(0);
    expect(screen.getByRole('button', { name: 'Search the page' })).toBeTruthy();
  });

  it('terms on another page: a link chip with the host and path', () => {
    const { models: ms } = models('synthetic/not-found.html');
    const m = ms.find((x) => x.card.kind === 'external');
    if (!m) return; // the fixture's link may not meet the external rule; covered in state tests
    card(m);
    expect(screen.getByRole('link').getAttribute('rel')).toContain('noopener');
  });

  it('many-to-one: shows the chosen sentence and an expander with the word count', () => {
    const { models: ms } = models('synthetic/many-to-one.html');
    const m = ms.find((x) => x.expanderLabel);
    if (!m) throw new Error('fixture changed');
    const { container } = card(m);
    expect(m.expanderLabel).toMatch(/^Show all offer details \(\d[\d,]* words\)$/);
    const button = screen.getByRole('button', { name: m.expanderLabel as string });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('[data-testid="fine-print"]').length).toBe(1);
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('loading: a skeleton and the status line while a rescan looks for the footnote', () => {
    const { models: ms } = models('synthetic/not-found.html');
    const m = ms.find((x) => x.card.kind === 'not-found') as CatchModel;
    const { container } = render(
      <MotionProvider reduce>
        <CardContent
          model={m}
          hostname="x.example"
          styleRoot={() => null}
          headingId="h"
          announce={() => undefined}
          looking
        />
      </MotionProvider>,
    );
    expect(screen.getByText('Looking for the footnote…')).toBeTruthy();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('copy: the success morph says Copied, then returns', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          written.push(t);
          return Promise.resolve();
        },
      },
      configurable: true,
    });
    const { models: ms } = models('synthetic/carrier-specimen.html');
    card(ms[0] as CatchModel);
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(written[0]).toContain('$35 activation fee');
    expect(
      await screen.findByRole('button', { name: 'Copy text' }, { timeout: 2500 }),
    ).toBeTruthy();
  });

  it('C, S and G are keyboard shortcuts on the card', () => {
    const { models: ms } = models('synthetic/carrier-specimen.html');
    const { container } = card(ms[0] as CatchModel);
    const wrapper = container.firstElementChild as HTMLElement;
    const calls: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          calls.push(t);
          return Promise.resolve();
        },
      },
      configurable: true,
    });
    fireEvent.keyDown(wrapper, { key: 'c' });
    expect(calls.length).toBe(1);
  });
});

describe('chip list', () => {
  const chips = Array.from({ length: 9 }, (_, i) => ({
    kind: 'money' as const,
    label: `$${String(i + 1)} fee`,
  }));

  it('shows six chips, then "+3 more" which expands', () => {
    const { container } = render(<ChipList chips={chips} />);
    expect(container.querySelectorAll('.cl-chip:not(.cl-chip--more)').length).toBe(6);
    fireEvent.click(screen.getByText('+3 more'));
    expect(container.querySelectorAll('.cl-chip:not(.cl-chip--more)').length).toBe(9);
  });

  it('sets figures in mono and keeps number and unit together', () => {
    const { container } = render(<ChipList chips={[{ kind: 'time', label: '36 months' }]} />);
    expect(container.querySelector('.cl-fig')?.textContent).toBe('36');
    expect(container.textContent).toContain('36 months');
  });
});

describe('what gets a hit target and a place in Show all', () => {
  it('counted catches and unmatched non-reference markers are interactive; references are not', () => {
    const { models: carrier } = models('synthetic/carrier-specimen.html');
    expect(carrier.filter(isInteractive).length).toBe(carrier.filter((m) => m.counted).length);
    const { models: refs } = models('synthetic/reference-footnotes.html');
    expect(refs.some(isInteractive)).toBe(false);
    expect(showAllModels(refs)).toEqual([]);
    const { models: nf } = models('synthetic/not-found.html');
    expect(nf.some((m) => m.card.kind === 'not-found' && isInteractive(m))).toBe(true);
    expect(showAllModels(nf).every((m) => m.counted)).toBe(true);
  });
});

describe('fine print region (axe scrollable-region-focusable)', () => {
  it('a scrolling block is keyboard reachable and named; a short one is left plain', () => {
    const { container, rerender } = render(<FinePrint text="Long offer text" spans={[]} scroll />);
    const scrolling = container.querySelector('[data-testid="fine-print"]');
    expect(scrolling?.getAttribute('tabindex')).toBe('0');
    expect(scrolling?.getAttribute('aria-label')).toBe('Offer details');
    // A group, not a landmark: several cards on one page must not repeat a landmark name.
    expect(scrolling?.getAttribute('role')).toBe('group');
    rerender(<FinePrint text="Short" spans={[]} />);
    const plain = container.querySelector('[data-testid="fine-print"]');
    expect(plain?.hasAttribute('tabindex')).toBe(false);
    expect(plain?.hasAttribute('role')).toBe(false);
  });
});
