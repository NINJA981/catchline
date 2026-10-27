// Minimal popup placeholder (Stage 2). It shows the real rollup and every state from DESIGN.md's
// table as plain text on tokens; the designed ledger, catch list and footer come in the UI stage.

import type { ReactNode } from 'react';
import { derivePopupView, type PopupView } from '../../core';
import { usePopupInput } from './usePopupInput';

export function App() {
  const view = derivePopupView(usePopupInput());
  return (
    <main className="w-popup bg-paper p-3 text-ui text-ink">
      <header className="flex h-12 items-center justify-between border-b border-rule">
        <span className="text-label text-ink">Catchline</span>
      </header>
      <section className="py-4" aria-live="polite">
        <PopupBody view={view} />
      </section>
    </main>
  );
}

function PopupBody({ view }: { view: PopupView }): ReactNode {
  switch (view.kind) {
    case 'blank':
      return null;
    case 'loading':
      return <div className="h-7 w-40 rounded-xs bg-sheet-2" aria-label="Scanning this page" />;
    case 'success':
      return (
        <>
          <h1 className="text-h2 text-ink">{view.heading}</h1>
          <p className="mt-1 text-caption text-ink-muted">{view.summary}</p>
        </>
      );
    case 'reference-only':
      return (
        <>
          <h1 className="text-h2 text-ink">0 catches</h1>
          <p className="mt-1 text-ui text-ink-muted">{view.copy}</p>
        </>
      );
    case 'permission':
    case 'error':
    case 'empty':
    case 'restricted':
    case 'disabled':
      return <p className="text-ui text-ink-muted">{view.copy}</p>;
  }
}
