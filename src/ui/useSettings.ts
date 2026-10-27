// Settings for extension pages: loaded from chrome.storage.local, kept live by the storage change
// event, written through the sanitizing adapter. Also applies theme and motion to the page itself.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, getSettings, updateSettings, watchSettings } from '../storage/settings';
import type { Settings } from '../core';

export type SaveState =
  { kind: 'idle' } | { kind: 'saved'; at: Date } | { kind: 'error'; retry: () => void };

export function useSettings(): {
  settings: Settings;
  loaded: boolean;
  save: (patch: Partial<Omit<Settings, 'version'>>) => void;
  saveState: SaveState;
} {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void getSettings().then((s) => {
      if (!alive.current) return;
      setSettings(s);
      setLoaded(true);
    });
    const off = watchSettings((s) => {
      setSettings(s);
    });
    return () => {
      alive.current = false;
      off();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light' || settings.theme === 'dark') {
      root.setAttribute('data-theme', settings.theme);
    } else {
      root.removeAttribute('data-theme');
    }
    root.setAttribute('data-motion', settings.motion);
  }, [settings.theme, settings.motion]);

  const save = useCallback((patch: Partial<Omit<Settings, 'version'>>) => {
    // Changes apply instantly; storage confirms or the error line offers a retry.
    setSettings((s) => ({ ...s, ...patch }));
    const run = () => {
      updateSettings(patch).then(
        () => {
          if (alive.current) setSaveState({ kind: 'saved', at: new Date() });
        },
        () => {
          if (alive.current) setSaveState({ kind: 'error', retry: run });
        },
      );
    };
    run();
  }, []);

  return { settings, loaded, save, saveState };
}
