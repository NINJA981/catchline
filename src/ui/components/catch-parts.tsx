// Parts of a catch shared by the card, the Show all rail, the popup and the welcome page.

import {
  Banknote,
  CalendarClock,
  CircleSlash,
  Info,
  ListChecks,
  Percent,
  Repeat,
  Check,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  MAX_VISIBLE_CHIPS,
  segmentText,
  splitFigures,
  visibleChips,
  type Chip,
  type ChipKind,
} from '../../core';
import { cn } from '../cn';

const KIND_ICON: Record<ChipKind, typeof Banknote> = {
  money: Banknote,
  time: CalendarClock,
  rate: Percent,
  requirement: ListChecks,
  exclusion: CircleSlash,
  renewal: Repeat,
};

/** A label with every figure set in Commit Mono. */
export function FigureText({ text }: { text: string }) {
  return (
    <>
      {splitFigures(text).map((s, i) =>
        s.figure ? (
          <span key={i} className="cl-fig">
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** Numbers and units stay on one line: "36 months" never breaks between the two. */
export function nbsp(label: string): string {
  return label.replace(/(\d) (months?|years?|days?|GB|MB|TB|%|weeks?)\b/g, '$1 $2');
}

export function ChipView({ chip, index }: { chip: Pick<Chip, 'kind' | 'label'>; index?: number }) {
  const Icon = KIND_ICON[chip.kind];
  return (
    <span className="cl-chip" data-kind={chip.kind} data-chip-index={index}>
      <Icon size={16} strokeWidth={1.5} aria-hidden />
      <span title={chip.label}>
        <FigureText text={nbsp(chip.label)} />
      </span>
    </span>
  );
}

/** At most six chips, then "+N more" which expands (DESIGN.md chip rules). */
export function ChipList({ chips }: { chips: readonly Pick<Chip, 'kind' | 'label'>[] }) {
  const [expanded, setExpanded] = useState(false);
  const { shown, more } = visibleChips(chips, expanded);
  if (chips.length === 0) return null;
  return (
    <div className="cl-chips" role="list" aria-label="Terms found">
      {shown.map((c, i) => (
        <span
          role="listitem"
          key={`${c.kind}-${c.label}-${String(i)}`}
          style={{ display: 'contents' }}
        >
          <ChipView chip={c} index={i} />
        </span>
      ))}
      {more > 0 && (
        <button
          type="button"
          className="cl-chip cl-chip--more"
          onClick={() => {
            setExpanded(true);
          }}
          aria-label={`Show ${String(more)} more terms (of ${String(chips.length)}; the first ${String(MAX_VISIBLE_CHIPS)} are shown)`}
        >
          +{more} more
        </button>
      )}
    </div>
  );
}

/** Confidence in words, with the reason one hover away (DESIGN.md "Do"). */
export function ConfidenceTag({
  level,
  reason,
}: {
  level: 'matched' | 'likely';
  reason?: string | null;
}) {
  const label = level === 'matched' ? 'Matched' : 'Likely match';
  return (
    <span className="cl-tag" data-level={level} title={reason ?? undefined}>
      {level === 'matched' ? (
        <Check size={12} strokeWidth={1.5} aria-hidden />
      ) : (
        <Info size={12} strokeWidth={1.5} aria-hidden />
      )}
      {label}
    </span>
  );
}

/** The raw footnote text with the spans that produced chips washed in Prussian Wash. */
export function FinePrint({
  text,
  spans,
  scroll,
  children,
}: {
  text: string;
  spans: readonly (readonly [number, number])[];
  scroll?: boolean;
  children?: ReactNode;
}) {
  const parts = segmentText(text, spans);
  return (
    <div className={cn('cl-fine', scroll && 'cl-fine--scroll')} data-testid="fine-print">
      {parts.map((p, i) =>
        p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
      {children}
    </div>
  );
}
