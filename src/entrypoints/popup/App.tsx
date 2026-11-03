// The popup (SPEC F10, DESIGN.md "Popup (380 x up to 560)"): header with the per-site toggle, the
// rollup ledger, the catch list, and a footer with Show all and Options. Every state in the
// DESIGN.md table renders from derivePopupView; this file only draws.

import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  confidenceLevel,
  derivePopupView,
  ledgerRows,
  rollupSummary,
  truncateMiddle,
  type CatchSummary,
  type PopupView,
  type TabRollup,
} from '../../core';
import { ConfidenceTag, FigureText } from '../../ui/components/catch-parts';
import { Button, Keys, Panel, Skeleton, Toggle } from '../../ui/components/controls';
import { Disclosure } from '../../ui/components/Disclosure';
import { MotionProvider } from '../../ui/components/motion';
import { Mark } from '../../ui/components/Mark';
import { usePopup, type PopupModel } from './usePopupInput';

export function App() {
  const popup = usePopup();
  const view = derivePopupView(popup.input);
  useThemeAttrs(popup.theme, popup.motion);
  return (
    <MotionProvider reduce={popup.motion === 'reduce'}>
      <PopupShell popup={popup} view={view} />
    </MotionProvider>
  );
}

function useThemeAttrs(theme: string, motion: string) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    root.setAttribute('data-motion', motion);
  }, [theme, motion]);
}

function PopupShell({ popup, view }: { popup: PopupModel; view: PopupView }) {
  const canShowAll = view.kind === 'success';
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') window.close();
      else if ((e.key === 'a' || e.key === 'A') && canShowAll) {
        e.preventDefault();
        popup.showAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [canShowAll, popup]);

  const { host, enabledOnSite } = popup;
  const ownsHeading = view.kind === 'success' || view.kind === 'reference-only';
  const toggleable = host !== null && view.kind !== 'restricted' && view.kind !== 'permission';
  return (
    <main className="cl-root pop">
      <header className="pop-head">
        <span className="pop-brand">
          <Mark />
          {/* States with no count of their own still need a page heading (axe page-has-heading-one). */}
          {ownsHeading ? (
            <span className="pop-word">Catchline</span>
          ) : (
            <span className="pop-word" role="heading" aria-level={1}>
              Catchline
            </span>
          )}
        </span>
        {host && (
          <span className="pop-host cl-subtle" title={host}>
            {truncateMiddle(host, 26)}
          </span>
        )}
        {view.kind === 'loading' && (
          <span className="pop-site" aria-hidden>
            <Skeleton h={16} w={64} />
            <Skeleton h={18} w={32} className="pop-skel-toggle" />
          </span>
        )}
        {toggleable && (
          <label className="pop-site">
            <span className="cl-caption cl-muted">On this site</span>
            <Toggle
              checked={enabledOnSite}
              onChange={popup.toggleSite}
              label={`On this site: Catchline on ${host}`}
            />
          </label>
        )}
      </header>
      {/* One persistent live region: the loading-to-result change is announced from here. */}
      <div className="pop-sr" role="status" aria-live="polite">
        {announcement(view)}
      </div>
      <PopupBody popup={popup} view={view} />
      <footer className="pop-foot">
        {canShowAll ? (
          <Button variant="primary" className="pop-showall" onClick={popup.showAll}>
            Show all on page
            <Keys keys={['Alt', 'Shift', 'C']} />
          </Button>
        ) : view.kind === 'loading' ? (
          <Skeleton h={32} className="pop-showall" />
        ) : (
          <span className="pop-spacer" />
        )}
        <Button variant="ghost" onClick={popup.openOptions}>
          Options
        </Button>
      </footer>
    </main>
  );
}

function announcement(view: PopupView): string {
  switch (view.kind) {
    case 'loading':
      return 'Scanning this page';
    case 'success':
      return rollupSummary(view.rollup);
    case 'reference-only':
      return '0 catches';
    default:
      return '';
  }
}

function PopupBody({ popup, view }: { popup: PopupModel; view: PopupView }): ReactNode {
  switch (view.kind) {
    case 'blank':
      return <div className="pop-body pop-body--blank" aria-hidden />;
    case 'loading':
      return <LoadingBody />;
    case 'restricted':
      return (
        <div className="pop-body">
          <Panel icon={<Info size={16} strokeWidth={1.5} aria-hidden />}>{view.copy}</Panel>
        </div>
      );
    case 'permission':
      return (
        <div className="pop-body">
          <Panel
            tone="warning"
            icon={<ShieldAlert size={16} strokeWidth={1.5} aria-hidden />}
            title="Permission needed"
            action={
              <Button variant="primary" onClick={popup.allowAllSites}>
                {view.action}
              </Button>
            }
          >
            {view.copy}
          </Panel>
        </div>
      );
    case 'disabled':
      return (
        <div className="pop-body">
          <Panel
            icon={<Info size={16} strokeWidth={1.5} aria-hidden />}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  popup.toggleSite(true);
                }}
              >
                Turn on for {view.host}
              </Button>
            }
          >
            {view.copy}
          </Panel>
        </div>
      );
    case 'error':
      return (
        <div className="pop-body">
          <Panel
            tone="danger"
            icon={<AlertTriangle size={16} strokeWidth={1.5} aria-hidden />}
            title="Can't reach this page"
            action={
              <Button variant="secondary" onClick={popup.reloadPage}>
                {view.action}
              </Button>
            }
          >
            {view.copy}
          </Panel>
        </div>
      );
    case 'empty':
      return (
        <div className="pop-body">
          <Panel
            action={
              <Button variant="secondary" onClick={popup.openWelcome}>
                {view.action}
              </Button>
            }
          >
            {view.copy}
          </Panel>
        </div>
      );
    case 'reference-only':
      return (
        <div className="pop-body">
          <div className="pop-count">
            <h1 className="pop-h">
              <span className="cl-fig">0</span> catches
            </h1>
            <p className="cl-muted">{view.copy}</p>
          </div>
          <OtherFootnotes
            catches={popup.catches.filter((c) => !c.counted)}
            defaultOpen
            onReveal={popup.reveal}
          />
        </div>
      );
    case 'success':
      return <SuccessBody popup={popup} rollup={view.rollup} />;
  }
}

/** Boxes at the geometry of the loaded popup, so nothing moves when the data arrives. */
function LoadingBody() {
  return (
    <div
      className="pop-body pop-body--loading"
      role="group"
      aria-busy="true"
      aria-label="Scanning this page"
    >
      <div className="pop-count">
        <Skeleton h={28} w={140} />
        <Skeleton h={20} w={200} />
      </div>
      <div className="pop-ledger">
        {[0, 1, 2].map((i) => (
          <div key={i} className="pop-lrow">
            <Skeleton h={12} w={72} />
            <Skeleton h={12} w={120} className="pop-skel-value" />
          </div>
        ))}
      </div>
      <div className="pop-list-wrap">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pop-row pop-row--skel">
            <Skeleton h={16} w="60%" />
            <Skeleton h={12} w="35%" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessBody({ popup, rollup }: { popup: PopupModel; rollup: TabRollup }) {
  const rows = useMemo(() => ledgerRows(rollup).slice(0, 8), [rollup]);
  const summary = rollupSummary(rollup);
  const detail = summary.includes(': ') ? summary.slice(summary.indexOf(': ') + 2) : null;
  const counted = popup.catches.filter((c) => c.counted);
  const other = popup.catches.filter((c) => !c.counted);
  return (
    <div className="pop-body">
      <div className="pop-count">
        <h1 className="pop-h" aria-label={summary}>
          <span className="cl-fig">{rollup.catches}</span>{' '}
          {rollup.catches === 1 ? 'catch' : 'catches'}
        </h1>
        {detail && (
          <p className="pop-detail">
            <FigureText text={detail} />
          </p>
        )}
      </div>
      {rows.length > 0 && (
        <dl className="pop-ledger">
          {rows.map((r) => (
            <div key={`${r.category}-${r.value}`} className="pop-lrow">
              <dt className="cl-muted">
                {r.first ? r.category : <span className="pop-sr">{r.category}</span>}
              </dt>
              <dd>
                <FigureText text={r.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <CatchList catches={counted} onReveal={popup.reveal} />
      {other.length > 0 && <OtherFootnotes catches={other} onReveal={popup.reveal} />}
    </div>
  );
}

function OtherFootnotes({
  catches,
  defaultOpen,
  onReveal,
}: {
  catches: CatchSummary[];
  defaultOpen?: boolean;
  onReveal: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  if (catches.length === 0) return null;
  return (
    <div className="pop-other">
      <Disclosure
        open={open}
        onOpenChange={setOpen}
        label={`Other footnotes (${String(catches.length)})`}
      >
        <CatchList catches={catches} onReveal={onReveal} label="Other footnotes" />
      </Disclosure>
    </div>
  );
}

function CatchList({
  catches,
  onReveal,
  label = 'Catches on this page',
}: {
  catches: CatchSummary[];
  onReveal: (id: string) => void;
  label?: string;
}) {
  const [active, setActive] = useState(0);
  const base = useId();
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = listRef.current?.children[active];
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [active]);
  if (catches.length === 0) return null;
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(catches.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const c = catches[active];
      if (c) {
        e.preventDefault();
        onReveal(c.id);
      }
    }
  };
  return (
    <div className="pop-list-wrap">
      <ul
        ref={listRef}
        className="pop-list"
        role="listbox"
        aria-label={label}
        tabIndex={0}
        aria-activedescendant={`${base}-${String(active)}`}
        onKeyDown={onKey}
      >
        {catches.map((c, i) => {
          const level = confidenceLevel(c.confidence, c.matched);
          return (
            <li
              key={c.id}
              id={`${base}-${String(i)}`}
              role="option"
              aria-selected={i === active}
              className="pop-row"
              data-selected={i === active}
              onClick={() => {
                setActive(i);
                onReveal(c.id);
              }}
            >
              <span className="pop-row__main">
                <span className="pop-row__claim">{c.claimText}</span>
                <span className="pop-row__chips cl-muted">
                  {c.chipLabels.length === 0 ? (
                    <span>{c.matched ? 'No terms found' : 'No footnote found'}</span>
                  ) : (
                    // One line; a row that does not fit ends in an ellipsis instead of losing labels.
                    <FigureText text={c.chipLabels.join(' · ')} />
                  )}
                </span>
              </span>
              {level !== 'not-found' && <ConfidenceTag level={level} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
