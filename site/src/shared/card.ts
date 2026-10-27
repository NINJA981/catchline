// The catch card (DESIGN.md "Catch card"), built from engine data. Copy, states and highlighting
// come from the shared engine module; this file only turns them into DOM.

import {
  cardState,
  expanderLabel,
  rebaseSpans,
  segmentText,
  splitFigures,
  visibleChips,
  wordCount,
  type Analysis,
  type Catch,
  type Chip,
  type ChipKind,
} from '@catchline/core';
import { clear, h, icon } from './dom';
import type { IconName } from './icons.generated';

export interface CardAction {
  id: string;
  label: string;
  icon: IconName;
  run(): void;
}

export interface CardView {
  el: HTMLElement;
  /** Chip elements that animate in the signature moment. */
  chips: HTMLElement[];
  /** The fine-print block, when the catch has a footnote. */
  fine: HTMLElement | null;
  actions: Map<string, HTMLButtonElement>;
}

export interface FinePrint {
  /** Text shown by default: the chosen sentence for many-to-one, else the footnote line. */
  text: string;
  /** Chip spans in `text` coordinates. */
  spans: [number, number][];
  /** The whole footnote block, when the default is a single sentence of it. */
  full: { text: string; spans: [number, number][]; words: number } | null;
}

const KIND_ICON: Record<ChipKind, IconName> = {
  money: 'banknote',
  time: 'calendar-clock',
  rate: 'percent',
  requirement: 'list-checks',
  exclusion: 'circle-slash',
  renewal: 'repeat',
};

export function finePrintFor(c: Catch, analysis: Analysis): FinePrint | null {
  const id = c.match.footnoteId;
  const fn = id ? analysis.footnotes.get(id) : undefined;
  if (!fn) return null;
  const all = fn.block.text;
  const spans = c.chips.map((chip) => chip.span);
  const sentence = c.match.sentence;
  if (sentence) {
    return {
      text: all.slice(sentence.start, sentence.end),
      spans: rebaseSpans(spans, sentence.start),
      full: { text: all, spans: rebaseSpans(spans, 0), words: wordCount(all) },
    };
  }
  return { text: all, spans: rebaseSpans(spans, 0), full: null };
}

/** Plain text of one catch, for "Copy text". */
export function catchPlainText(c: Catch, analysis: Analysis): string {
  const fine = finePrintFor(c, analysis);
  const lines = [c.marker.claimText];
  if (c.chips.length) lines.push('', ...c.chips.map((chip) => `- ${chip.label}`));
  if (fine) lines.push('', fine.text);
  return lines.join('\n');
}

function figureNodes(label: string): (Node | string)[] {
  return splitFigures(label).map((seg) =>
    seg.figure ? h('span', { class: 'fig' }, seg.text) : seg.text,
  );
}

export function chipEl(chip: Chip): HTMLElement {
  return h(
    'li',
    { class: `chip chip--${chip.kind}` },
    icon(KIND_ICON[chip.kind]),
    h('span', null, ...figureNodes(chip.label)),
  );
}

function fineNodes(text: string, spans: readonly [number, number][]): (Node | string)[] {
  return segmentText(text, spans).map((seg) => (seg.mark ? h('mark', null, seg.text) : seg.text));
}

function safeHttpHref(href: string): string | null {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

let uid = 0;

export function buildCard(c: Catch, analysis: Analysis, actions: readonly CardAction[]): CardView {
  const state = cardState(c);
  const fine = finePrintFor(c, analysis);
  const headingId = `card-claim-${String(++uid)}`;
  const chipEls: HTMLElement[] = [];
  const actionEls = new Map<string, HTMLButtonElement>();

  const tag =
    state.kind === 'matched' || state.kind === 'likely' || state.kind === 'many-to-one'
      ? h('span', { class: 'tag' }, icon(state.tag === 'Matched' ? 'check' : 'info'), state.tag)
      : null;

  const head = h(
    'header',
    { class: 'card__head' },
    h('h3', { class: 'card__claim', id: headingId }, c.marker.claimText),
    tag,
  );

  const body: HTMLElement[] = [head];

  const reason =
    state.kind === 'likely' ? state.reason : state.kind === 'many-to-one' ? state.reason : null;
  if (reason) body.push(h('p', { class: 'card__reason' }, reason));

  // Chips, six at most until expanded.
  let chipsList: HTMLElement | null = null;
  if (c.chips.length > 0) {
    chipsList = h('ul', { class: 'chips', 'aria-label': 'Terms found' });
    let expanded = false;
    const paint = (): void => {
      clear(chipsList as HTMLElement);
      chipEls.length = 0;
      const { shown, more } = visibleChips(c.chips, expanded);
      for (const chip of shown) {
        const li = chipEl(chip);
        chipEls.push(li);
        chipsList?.appendChild(li);
      }
      if (more > 0) {
        chipsList?.appendChild(
          h(
            'li',
            null,
            h(
              'button',
              {
                class: 'chip chip--more',
                type: 'button',
                onclick: () => {
                  expanded = true;
                  paint();
                },
              },
              `+${String(more)} more`,
            ),
          ),
        );
      }
    };
    paint();
    body.push(chipsList);
  }

  let fineBlock: HTMLElement | null = null;
  if (state.kind === 'not-found') {
    body.push(h('p', { class: 'card__panel' }, state.copy));
  } else {
    if (state.kind === 'external') {
      const href = safeHttpHref(state.href);
      body.push(
        h(
          'p',
          { class: 'card__panel' },
          href
            ? h('a', { href, rel: 'noopener noreferrer', target: '_blank' }, state.copy)
            : state.copy,
        ),
      );
    }
    if (fine) {
      const textEl = h('p', { class: 'fine__text' }, ...fineNodes(fine.text, fine.spans));
      fineBlock = h('div', { class: 'fine' }, textEl);
      const full = fine.full;
      if (full) {
        const fineId = `fine-${String(uid)}`;
        textEl.id = fineId;
        let open = false;
        const toggle = h(
          'button',
          {
            class: 'fine__more',
            type: 'button',
            'aria-expanded': 'false',
            'aria-controls': fineId,
          },
          expanderLabel(full.words),
        );
        toggle.addEventListener('click', () => {
          open = !open;
          clear(textEl);
          const src = open ? full : fine;
          textEl.append(...fineNodes(src.text, src.spans));
          toggle.setAttribute('aria-expanded', String(open));
          toggle.textContent = open ? 'Show less' : expanderLabel(full.words);
        });
        fineBlock.appendChild(toggle);
      }
      body.push(fineBlock);
    }
  }

  if (actions.length) {
    const row = h('footer', { class: 'card__actions' });
    for (const a of actions) {
      const btn = h(
        'button',
        {
          class: 'btn btn--ghost',
          type: 'button',
          'data-action': a.id,
          onclick: () => {
            a.run();
          },
        },
        icon(a.icon),
        h('span', null, a.label),
      );
      actionEls.set(a.id, btn);
      row.appendChild(btn);
    }
    body.push(row);
  }

  const el = h('article', { class: 'card', 'aria-labelledby': headingId, tabindex: '-1' }, ...body);
  return { el, chips: chipEls, fine: fineBlock, actions: actionEls };
}
