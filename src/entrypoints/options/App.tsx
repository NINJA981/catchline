// Options page (SPEC F11, DESIGN.md "Options page (720 max)"). Every Settings field is editable here,
// changes apply instantly, and the header says "Saved" with the time instead of raising a toast.

import { Check, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { FAMILIES, type Family } from '../../core';
import { Mark } from '../../ui/components/Mark';
import { Button, Keys, Segmented, Skeleton, Toggle } from '../../ui/components/controls';
import { MotionProvider } from '../../ui/components/motion';
import { useSettings, type SaveState } from '../../ui/useSettings';

interface FamilyScore {
  markerRecall?: number;
  pairPrecision?: number;
  pairRecall?: number;
  chipRecall?: number;
}
interface CorpusReport {
  commit?: string;
  families?: Partial<Record<Family, FamilyScore>>;
}

// Read at build time (AC-F11.3). Until the corpus exists there is no file and nothing is shown.
const reports = import.meta.glob<CorpusReport>('../../../corpus/report.json', {
  eager: true,
  import: 'default',
});
const report: CorpusReport | null = Object.values(reports)[0] ?? null;

const FAMILY_LABEL: Record<Family, string> = {
  carrier: 'Carrier and broadband',
  bank: 'Bank and credit',
  retail: 'Shopping',
  streaming: 'Streaming',
  saas: 'SaaS pricing',
  travel: 'Airline and travel',
};

function onDeviceModelAvailable(): boolean {
  const g = globalThis as Record<string, unknown>;
  return typeof g.LanguageModel !== 'undefined' || typeof g.Summarizer !== 'undefined';
}

export function App() {
  const { settings, loaded, save, saveState } = useSettings();
  return (
    <MotionProvider reduce={settings.motion === 'reduce'}>
      <div className="cl-root page opt-page">
        <header className="opt-top">
          <div className="page-head">
            <span className="page-word">
              <Mark />
              Catchline
            </span>
            <SaveStatus state={saveState} />
          </div>
        </header>
        <main className="opt">
          <h1>Options</h1>
          <p className="opt-lede">
            Changes apply as you make them, on every open page within a second.
          </p>
          {loaded ? (
            <Sections settings={settings} save={save} saveState={saveState} />
          ) : (
            <OptionsSkeleton />
          )}
        </main>
      </div>
    </MotionProvider>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state.kind === 'saved') {
    const t = state.at.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return (
      <span className="opt-status" data-state="saved" role="status">
        <Check size={16} strokeWidth={1.5} aria-hidden />
        Saved <span className="cl-fig">{t}</span>
      </span>
    );
  }
  if (state.kind === 'error') {
    return (
      <span className="opt-status" data-state="error" role="status">
        <TriangleAlert size={16} strokeWidth={1.5} aria-hidden />
        Not saved
      </span>
    );
  }
  return <span className="opt-status" role="status" />;
}

function OptionsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading options">
      {[0, 1, 2].map((i) => (
        <section className="opt-sec" key={i}>
          <Skeleton h={24} w={200} />
          <div style={{ height: 8 }} />
          <Skeleton h={20} w="60%" />
          <div style={{ height: 16 }} />
          <Skeleton h={64} />
        </section>
      ))}
    </div>
  );
}

type Save = (patch: Partial<Omit<import('../../core').Settings, 'version'>>) => void;

function Section({
  title,
  lead,
  saveState,
  children,
  id,
}: {
  title: string;
  lead: string;
  saveState?: SaveState;
  children?: ReactNode;
  id: string;
}) {
  return (
    <section className="opt-sec" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p>{lead}</p>
      {children}
      {saveState?.kind === 'error' && (
        <div className="opt-err" role="alert">
          <span>Couldn't save. Your browser's extension storage is full or unavailable.</span>
          <Button variant="secondary" onClick={saveState.retry}>
            Try again
          </Button>
        </div>
      )}
    </section>
  );
}

function Sections({
  settings,
  save,
  saveState,
}: {
  settings: import('../../core').Settings;
  save: Save;
  saveState: SaveState;
}) {
  const modelAvailable = onDeviceModelAvailable();
  return (
    <>
      <Section
        id="run"
        title="Where Catchline runs"
        lead="Scanning happens in your browser. Nothing is sent anywhere."
        saveState={saveState}
      >
        <div className="opt-radio" role="radiogroup" aria-labelledby="run">
          <label>
            <input
              type="radio"
              name="runOn"
              checked={settings.runOn === 'all-sites'}
              onChange={() => {
                save({ runOn: 'all-sites' });
              }}
            />
            <span>
              <strong style={{ fontWeight: 500 }}>On every page</strong>
              <br />
              <span className="cl-muted">Shows a count in the toolbar</span>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="runOn"
              checked={settings.runOn === 'on-click'}
              onChange={() => {
                save({ runOn: 'on-click' });
              }}
            />
            <span>
              <strong style={{ fontWeight: 500 }}>Only when I click the toolbar button</strong>
              <br />
              <span className="cl-muted">No badge until you open Catchline on a page</span>
            </span>
          </label>
        </div>
      </Section>

      <Section
        id="sites"
        title="Sites turned off"
        lead="Catchline does nothing on these sites."
        saveState={saveState}
      >
        {settings.disabledHosts.length === 0 ? (
          <p className="opt-empty">
            No sites turned off. Turn Catchline off for a site from the popup.
          </p>
        ) : (
          <ul className="opt-sites">
            {settings.disabledHosts.map((h) => (
              <li key={h}>
                <span>{h}</span>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${h} from the list`}
                  onClick={() => {
                    save({ disabledHosts: settings.disabledHosts.filter((x) => x !== h) });
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="page"
        title="On the page"
        lead="How Catchline shows what it found."
        saveState={saveState}
      >
        <div className="opt-row">
          <div>
            <strong>Mark catches with a thin underline</strong>
            <span className="cl-muted">
              Under each * † ‡ or ¹ with a catch. Turn off to keep pages untouched.
            </span>
          </div>
          <Toggle
            checked={settings.markCatchesOnPage}
            onChange={(v) => {
              save({ markCatchesOnPage: v });
            }}
            label="Mark catches with a thin underline"
          />
        </div>
        <div className="opt-row">
          <div>
            <strong>Show the count on the toolbar button</strong>
            <span className="cl-muted">The badge and its tooltip.</span>
          </div>
          <Toggle
            checked={settings.badge}
            onChange={(v) => {
              save({ badge: v });
            }}
            label="Show the count on the toolbar button"
          />
        </div>
      </Section>

      <Section
        id="motion"
        title="Motion"
        lead="The first card on a page flies up on its line. Reduced motion fades it in instead."
        saveState={saveState}
      >
        <div className="opt-ctl">
          <Segmented
            label="Motion"
            value={settings.motion}
            onChange={(motion) => {
              save({ motion });
            }}
            options={[
              { value: 'system', label: 'Follow system' },
              { value: 'reduce', label: 'Reduce motion always' },
            ]}
          />
        </div>
      </Section>

      <Section
        id="theme"
        title="Theme"
        lead="Applies to the popup, this page and the card on web pages."
        saveState={saveState}
      >
        <div className="opt-ctl">
          <Segmented
            label="Theme"
            value={settings.theme}
            onChange={(theme) => {
              save({ theme });
            }}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Section>

      <Section
        id="plain"
        title="Plain-language line"
        lead="An optional one-line summary of a catch, written by a model that runs on this device. Off by default. The chips and the merchant's words never depend on it."
        saveState={saveState}
      >
        <div className="opt-row">
          <div>
            <strong>Write a one-line summary on each card</strong>
            <span className="cl-muted">
              {modelAvailable
                ? 'A model is available on this device. The summary line is not in this version yet, so this switch is saved for a later release.'
                : "This browser can't run an on-device model, so the line is unavailable. Chips and the original text are unchanged."}
            </span>
          </div>
          <Toggle
            checked={settings.plainLine.enabled}
            onChange={(enabled) => {
              save({ plainLine: { ...settings.plainLine, enabled } });
            }}
            label="Write a one-line summary on each card"
          />
        </div>
      </Section>

      <Section
        id="accuracy"
        title="Accuracy"
        lead="How often Catchline pairs the right footnote with the right claim, measured on saved pages."
      >
        {report?.families ? (
          <table className="opt-table">
            <thead>
              <tr>
                <th scope="col">Page type</th>
                <th scope="col">Pairs correct</th>
                <th scope="col">Pairs found</th>
              </tr>
            </thead>
            <tbody>
              {FAMILIES.map((f) => {
                const s = report.families?.[f];
                return (
                  <tr key={f}>
                    <th scope="row" style={{ fontWeight: 400 }}>
                      {FAMILY_LABEL[f]}
                    </th>
                    <td className="cl-fig">
                      {s?.pairPrecision === undefined
                        ? 'Not yet measured'
                        : `${String(Math.round(s.pairPrecision * 100))}%`}
                    </td>
                    <td className="cl-fig">
                      {s?.pairRecall === undefined
                        ? 'Not yet measured'
                        : `${String(Math.round(s.pairRecall * 100))}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="opt-empty">
            Not yet measured. These numbers appear here once the saved-page corpus has been scored,
            along with the version they came from.
          </p>
        )}
        {report?.commit && (
          <p className="cl-caption cl-subtle" style={{ marginTop: 8 }}>
            Measured at <span className="cl-fig">{report.commit}</span>
          </p>
        )}
      </Section>

      <Section
        id="keys"
        title="Keyboard shortcuts"
        lead="Single keys only work while Catchline has focus, never while you type in a page."
      >
        <table className="opt-table">
          <tbody>
            {(
              [
                [['Alt', 'Shift', 'C'], 'Show all catches on this page'],
                [['Esc'], 'Close a card, or leave Show all and return to where you were'],
                [['C'], 'Copy the footnote text from an open card'],
                [['S'], 'Save the card as an image'],
                [['G'], 'Go to the footnote on the page'],
                [['J'], 'Next catch in Show all'],
                [['K'], 'Previous catch in Show all'],
                [['Enter'], 'Expand the selected catch'],
                [['?'], 'List the shortcuts in Show all'],
              ] as const
            ).map(([keys, what]) => (
              <tr key={what}>
                <td style={{ width: 160 }}>
                  <Keys keys={keys} />
                </td>
                <td style={{ textAlign: 'left' }}>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="opt-ctl">
          <Button
            variant="secondary"
            onClick={() => {
              void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
            }}
          >
            Change in browser settings
          </Button>
        </div>
      </Section>

      <Section
        id="privacy"
        title="Privacy"
        lead="Catchline makes no network requests. Settings stay in this browser. Page text is read in memory, never stored, and never leaves the page it came from."
      />
    </>
  );
}
