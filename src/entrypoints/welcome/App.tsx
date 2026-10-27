// Welcome page (SPEC F11, DESIGN.md "Welcome page"): opened once on install. The specimen on the
// left is a made-up promo page labeled as such; it runs the real scanner, markers and overlay, so
// the three steps on the right can be tried on it right away.

import { Check, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { analyze, createComputedStyleOracle, type Analysis, type Settings } from '../../core';
import { type Bridge } from '../../overlay/bridge';
import { createMarkerLayer } from '../../overlay/markers-layer';
import { mountOverlay } from '../../overlay/mount';
import { Mark } from '../../ui/components/Mark';
import { Button, Keys, Panel } from '../../ui/components/controls';
import { MotionProvider } from '../../ui/components/motion';
import { useLatest } from '../../ui/useLatest';
import { useSettings } from '../../ui/useSettings';

const IS_FIREFOX = import.meta.env.FIREFOX;

interface Controller {
  bridge: Bridge;
  markers: ReturnType<typeof createMarkerLayer>;
  settingsChanged: () => void;
}

export function App() {
  const { settings } = useSettings();
  const specimenRef = useRef<HTMLDivElement>(null);
  const settingsRef = useLatest<Settings>(settings);
  const ctl = useRef<Controller | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'needed' | 'granted'>('unknown');

  // Firefox MV3 treats host permissions as optional; Chrome grants them at install.
  useEffect(() => {
    if (!IS_FIREFOX) return;
    void browser.permissions.contains({ origins: ['<all_urls>'] }).then((ok) => {
      setPermission(ok ? 'granted' : 'needed');
    });
  }, []);

  // The specimen runs the real scanner, hit targets and overlay.
  useEffect(() => {
    const root = specimenRef.current;
    if (!root) return;
    let analysis: Analysis | null = null;
    const analysisSubs = new Set<() => void>();
    const settingsSubs = new Set<() => void>();
    const markers = createMarkerLayer({
      onOpen: (id) => {
        bridge.overlay?.dispatch({ kind: 'card', id });
      },
    });
    const scan = () => {
      analysis = analyze(document, createComputedStyleOracle(window), { root, family: 'carrier' });
      markers.update(analysis.catches);
      analysisSubs.forEach((cb) => {
        cb();
      });
    };
    const bridge: Bridge = {
      getAnalysis: () => analysis,
      onAnalysis: (cb) => {
        analysisSubs.add(cb);
        return () => analysisSubs.delete(cb);
      },
      getSettings: () => settingsRef.current,
      onSettings: (cb) => {
        settingsSubs.add(cb);
        return () => settingsSubs.delete(cb);
      },
      hostname: 'ridgeline.example',
      urlFor: (path) => browser.runtime.getURL(`/${path}` as '/popup.html'),
      rescan: scan,
      focusMarker: (id) => {
        markers.focus(id);
      },
      overlay: null,
      pending: null,
    };
    const handle = mountOverlay(bridge, { fonts: false });
    scan();
    ctl.current = {
      bridge,
      markers,
      settingsChanged: () => {
        settingsSubs.forEach((cb) => {
          cb();
        });
      },
    };
    return () => {
      ctl.current = null;
      handle.destroy();
      markers.destroy();
    };
  }, [settingsRef]);

  // Settings changes reach the overlay and the hit targets (theme, motion, underline).
  useEffect(() => {
    ctl.current?.markers.setQuiet(!settings.markCatchesOnPage);
    ctl.current?.settingsChanged();
  }, [settings]);

  // Alt+Shift+C works here without the browser command, which targets web pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyC') {
        e.preventDefault();
        ctl.current?.bridge.overlay?.dispatch({ kind: 'show-all' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const allow = () => {
    void browser.permissions.request({ origins: ['<all_urls>'] }).then((ok) => {
      if (ok) setPermission('granted');
    });
  };

  return (
    <MotionProvider reduce={settings.motion === 'reduce'}>
      <div className="cl-root page">
        <header className="page-head">
          <span className="page-word">
            <Mark />
            Catchline
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              void browser.runtime.openOptionsPage();
            }}
          >
            Options
          </Button>
        </header>
        <main className="wel">
          <h1>Welcome to Catchline</h1>
          <p className="wel-lede">
            Catchline pulls the fine print up to the claim it qualifies. Try it on the specimen
            below before you open a real offer.
          </p>
          {IS_FIREFOX && permission === 'needed' && (
            <div className="wel-perm">
              <Panel
                tone="warning"
                icon={<ShieldAlert size={16} strokeWidth={1.5} aria-hidden />}
                title="Allow Catchline to read pages"
                action={
                  <Button variant="primary" onClick={allow}>
                    Allow on all sites
                  </Button>
                }
              >
                Firefox asks before an add-on can read pages. Catchline reads them only to find fine
                print, and sends nothing anywhere.
              </Panel>
            </div>
          )}
          {IS_FIREFOX && permission === 'granted' && (
            <div className="wel-perm">
              <Panel
                tone="success"
                icon={<Check size={16} strokeWidth={1.5} aria-hidden />}
                title="Allowed"
              >
                Open any offer page to try it.
              </Panel>
            </div>
          )}
          <div className="wel-grid">
            <div>
              <div className="specimen-label">
                <span>Specimen page. Not a real offer.</span>
              </div>
              <div className="specimen" ref={specimenRef}>
                <Specimen />
              </div>
            </div>
            <aside className="wel-steps" aria-labelledby="steps">
              <h2
                id="steps"
                style={{
                  fontSize: 18,
                  fontWeight: 550,
                  lineHeight: '24px',
                  letterSpacing: '-0.012em',
                }}
              >
                Three things to try
              </h2>
              <ol>
                <li>
                  <div>
                    <strong>Click any * on a page</strong>
                    <p>On the specimen, click the thin underline after $0/mo.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Read the catch next to the claim</strong>
                    <p>
                      The footnote flies up on a line to the claim, at a size you can read. Esc puts
                      it away.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>
                      Press <Keys keys={['Alt', 'Shift', 'C']} /> to see every catch
                    </strong>
                    <p>
                      J and K step through them. Enter expands one. Esc takes you back to where you
                      were.
                    </p>
                  </div>
                </li>
              </ol>
              <p className="wel-privacy">
                Free. Runs in your browser. No account. Catchline makes no network requests, and
                your settings stay in this browser.
              </p>
            </aside>
          </div>
        </main>
      </div>
    </MotionProvider>
  );
}

/** A made-up carrier page. Every name and number here is invented for the specimen. */
function Specimen() {
  return (
    <>
      <nav className="spec-nav" aria-label="Specimen navigation">
        <b>Ridgeline Mobile</b>
        <span>Plans</span>
        <span>Phones</span>
        <span>Support</span>
      </nav>
      <section className="spec-hero">
        <h2>The Pixelstone 9, on us</h2>
        <div className="spec-price">
          $0<small>/mo</small>*
        </div>
        <p className="spec-sub">Unlimited¹ talk, text and data on every plan.</p>
        <p className="spec-sub">Switch today and get $200 off† any phone.</p>
        <span className="cl-btn cl-btn--primary spec-cta" aria-hidden>
          Get it now
        </span>
      </section>
      <section className="spec-plans" aria-label="Plans">
        <article className="spec-plan">
          <h3>Unlimited Starter</h3>
          <p>5G access, standard-definition streaming, and talk and text to Canada and Mexico.</p>
        </article>
        <article className="spec-plan">
          <h3>Unlimited Plus</h3>
          <p>Premium data, HD streaming and a mobile hotspot for your laptop.</p>
        </article>
      </section>
      <section className="spec-filler" aria-hidden>
        More of the page the offer sits on. Scroll down and the conditions are far from the claim,
        in small type, like most real promo pages.
      </section>
      <footer className="spec-legal">
        <p>
          *With 36-month installment agreement on the Pixelstone 9 (full retail price $799.99). $35
          activation fee. Autopay required. If you cancel service, remaining device balance is due.
          Tax on full retail price due at sale.
        </p>
        <p>
          ¹Unlimited: customers may notice slower speeds than other customers after 50GB of data per
          month. Video typically streams at 480p on Unlimited Starter.
        </p>
        <p>
          †$200 off via 24 monthly bill credits; requires new line and port-in from another carrier.
          Credits stop if you cancel early.
        </p>
        <p>Ridgeline Mobile is a fictional carrier. Specimen page. Not a real offer.</p>
      </footer>
    </>
  );
}
