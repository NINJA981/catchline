// The overlay root: one open card or Show all, driven by requests from the scanner, the popup, the
// shortcut and the keyboard. All view state is the pure reducers in src/core/state.

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  chooseVariant,
  initialShowAll,
  keyToAction,
  showAllReducer,
  type MotionVariant,
} from '../core';
import { Button, Panel } from '../ui/components/controls';
import { MotionProvider } from '../ui/components/motion';
import { useLatest } from '../ui/useLatest';
import { attachOverlay, type Bridge, type OverlayRequest } from './bridge';
import { CardLayer } from './CardLayer';
import { buildModels, showAllModels, type CatchModel } from './model';
import { ShowAll } from './ShowAll';

interface Props {
  bridge: Bridge;
  rootRef: { current: HTMLDivElement | null };
  onDestroy: () => void;
}

interface OpenCard {
  id: string;
  variant: MotionVariant;
}

class CardBoundary extends Component<
  { onClose: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(_e: Error, _info: ErrorInfo) {
    // Fixed, content-free message only (SPEC section 9).
    console.error('Catchline: a card failed to render');
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="cl-card" style={{ translate: '16px 16px' }} role="alert">
        <Panel tone="danger">
          Catchline couldn't place this card. Open it from the popup instead.
        </Panel>
        <Button variant="secondary" onClick={this.props.onClose}>
          Close
        </Button>
      </div>
    );
  }
}

/** True when Enter should act on the focused control instead of the rail. */
function ownsKey(origin: EventTarget | undefined): boolean {
  return (
    origin instanceof Element &&
    origin.closest('button, a[href], summary, input, select, textarea, [role="button"]') !== null
  );
}

function inExpandedEntry(origin: EventTarget | undefined): boolean {
  return origin instanceof Element && origin.closest('.cl-entry__open') !== null;
}

function prefersReduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function OverlayApp({ bridge, rootRef, onDestroy }: Props) {
  const [version, setVersion] = useState(0);
  const [card, setCard] = useState<OpenCard | null>(null);
  const [lookingId, setLookingId] = useState<string | null>(null);
  const [showAll, dispatch] = useReducer(showAllReducer, initialShowAll);
  const [pressed, setPressed] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [status, setStatus] = useState('');
  const firstOpen = useRef(true);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analysis = bridge.getAnalysis();
  const models = useMemo(
    () => (analysis ? buildModels(analysis) : []),
    // `version` bumps on every rescan, which replaces the analysis object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysis, version],
  );
  const modelsRef = useLatest<CatchModel[]>(models);
  const railModels = useMemo(() => showAllModels(models), [models]);
  const railRef = useLatest(railModels);
  const cardRef = useLatest(card);
  const showAllRef = useLatest(showAll);

  useEffect(() => {
    const offA = bridge.onAnalysis(() => {
      setVersion((v) => v + 1);
    });
    const offS = bridge.onSettings(() => {
      setVersion((v) => v + 1);
    });
    return () => {
      offA();
      offS();
    };
  }, [bridge]);

  const reduced = () => bridge.getSettings().motion === 'reduce' || prefersReduced();

  const closeCard = useCallback(
    (refocus: boolean) => {
      const open = cardRef.current;
      setCard(null);
      setLookingId(null);
      if (open && refocus) bridge.focusMarker(open.id);
    },
    [bridge, cardRef],
  );

  // The element that had focus when Show all opened, so leaving it puts focus back there.
  const returnFocus = useRef<Element | null>(null);

  const exitShowAll = useCallback(() => {
    const y = showAllRef.current.restoreScrollY;
    dispatch({ type: 'exit' });
    setHelp(false);
    if (y !== null) window.scrollTo({ top: y, behavior: 'instant' });
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back instanceof HTMLElement && back.isConnected && back !== document.body) {
      back.focus({ preventScroll: true });
    }
  }, [showAllRef]);

  const handle = useCallback(
    (req: OverlayRequest) => {
      if (req.kind === 'close') {
        closeCard(false);
        if (showAllRef.current.open) exitShowAll();
        return;
      }
      if (req.kind === 'show-all') {
        setCard(null);
        if (showAllRef.current.open) {
          exitShowAll();
          return;
        }
        returnFocus.current = document.activeElement;
        dispatch({
          type: 'enter',
          ids: railRef.current.map((m) => m.id),
          scrollY: window.scrollY,
        });
        return;
      }
      const m = modelsRef.current.find((x) => x.id === req.id);
      if (!m) return;
      if (showAllRef.current.open) exitShowAll();
      const variant = chooseVariant({ reducedMotion: reduced(), firstOpen: firstOpen.current });
      firstOpen.current = false;
      setCard({ id: req.id, variant });
      if (m.card.kind === 'not-found') {
        setLookingId(m.id);
        bridge.rescan();
      } else {
        setLookingId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bridge, closeCard, exitShowAll],
  );

  // Register with the bridge and pick up a request that arrived before the overlay loaded.
  useEffect(() => {
    const pending = attachOverlay(bridge, { dispatch: handle, destroy: onDestroy });
    // Handled on the next tick so the first render has committed.
    const t = pending
      ? setTimeout(() => {
          handle(pending);
        }, 0)
      : null;
    return () => {
      if (t) clearTimeout(t);
      attachOverlay(bridge, null);
    };
  }, [bridge, handle, onDestroy]);

  // "Looking for the footnote" ends after 2 s or when a rescan finds one.
  useEffect(() => {
    if (!lookingId) return;
    const t = setTimeout(() => {
      setLookingId(null);
    }, 2000);
    return () => {
      clearTimeout(t);
    };
  }, [lookingId]);
  const openModel = card ? models.find((m) => m.id === card.id) : undefined;
  const looking =
    lookingId !== null && lookingId === card?.id && openModel?.card.kind === 'not-found';

  // Keyboard: Esc closes the card; Show all owns J/K/Enter/Esc/? and ignores host inputs.
  useEffect(() => {
    const press = (label: string) => {
      setPressed(label);
      if (pressTimer.current) clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        setPressed(null);
      }, 120);
    };
    const trapTab = (e: KeyboardEvent) => {
      // Focus stays in the rail while Show all is open (Shift+Tab must not walk into the page).
      const root = rootRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'),
      );
      if (items.length === 0) return;
      const rootNode = root.getRootNode();
      const active = rootNode instanceof ShadowRoot ? rootNode.activeElement : null;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (!active || !root.contains(active) || active === root.querySelector('.cl-rail')) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (showAllRef.current.open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          press('Esc');
          if (help) setHelp(false);
          else exitShowAll();
          return;
        }
        if (e.key === 'Tab') {
          trapTab(e);
          return;
        }
        const origin = e.composedPath()[0];
        const action = keyToAction(e.key, origin ?? e.target);
        if (!action) return;
        // Enter and the arrow keys belong to the control that has focus: a button activates, the
        // fine print scrolls. The rail owns them only when focus is on the rail or the page body.
        if (action === 'toggle-expand' && ownsKey(origin)) return;
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && inExpandedEntry(origin)) return;
        e.preventDefault();
        e.stopPropagation();
        if (action === 'next') {
          press('J');
          dispatch({ type: 'next' });
        } else if (action === 'prev') {
          press('K');
          dispatch({ type: 'prev' });
        } else if (action === 'toggle-expand') {
          press('Enter');
          dispatch({ type: 'toggle-expand' });
        } else if (action === 'help') {
          press('?');
          setHelp((h) => !h);
        } else {
          exitShowAll();
        }
        return;
      }
      if (cardRef.current && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeCard(true);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, [closeCard, exitShowAll, help, cardRef, showAllRef, rootRef]);

  // A click outside the card closes it (clicks on the page itself pass through untouched).
  useEffect(() => {
    if (!card) return;
    const onDown = (e: PointerEvent) => {
      const path = e.composedPath();
      const host = rootRef.current?.getRootNode();
      const inside = path.some(
        (n) => n === rootRef.current || (host instanceof ShadowRoot && n === host.host),
      );
      if (!inside) closeCard(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [card, closeCard, rootRef]);

  const hostname = bridge.hostname;
  const styleRoot = useCallback(() => rootRef.current, [rootRef]);
  const announce = useCallback((t: string) => {
    setStatus('');
    // A fresh string each time, so repeated messages are read again.
    setTimeout(() => {
      setStatus(t);
    }, 20);
  }, []);

  return (
    <MotionProvider reduce={bridge.getSettings().motion === 'reduce'}>
      {showAll.open && (
        <ShowAll
          models={railModels}
          state={showAll}
          hostname={hostname}
          pressed={pressed}
          helpOpen={help}
          onSelect={(id) => {
            dispatch({ type: 'select', id });
          }}
          onToggleExpand={() => {
            dispatch({ type: 'toggle-expand' });
          }}
          onExit={exitShowAll}
          announce={announce}
          styleRoot={styleRoot}
        />
      )}
      {card && openModel && !showAll.open && (
        <CardBoundary
          key={card.id}
          onClose={() => {
            closeCard(false);
          }}
        >
          <CardLayer
            key={card.id}
            model={openModel}
            hostname={hostname}
            variant={card.variant}
            looking={looking}
            onClose={() => {
              closeCard(true);
            }}
            onLost={() => {
              closeCard(false);
            }}
            announce={announce}
            styleRoot={styleRoot}
          />
        </CardBoundary>
      )}
      <div className="cl-live" role="status" aria-live="polite">
        {status}
      </div>
    </MotionProvider>
  );
}
