// Show all catches (SPEC F6): selection with J/K, Enter expands, Esc exits. Pure reducer.

export interface ShowAllState {
  open: boolean;
  /** Catch ids in page order. */
  ids: readonly string[];
  selected: number;
  expandedId: string | null;
  /** Page scroll position to restore on exit (AC-F6.2). */
  restoreScrollY: number | null;
}

export type ShowAllAction =
  | { type: 'enter'; ids: readonly string[]; scrollY: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'select'; id: string }
  | { type: 'toggle-expand' }
  | { type: 'exit' };

export const initialShowAll: ShowAllState = {
  open: false,
  ids: [],
  selected: 0,
  expandedId: null,
  restoreScrollY: null,
};

export function showAllReducer(state: ShowAllState, action: ShowAllAction): ShowAllState {
  switch (action.type) {
    case 'enter':
      return {
        open: true,
        ids: action.ids,
        selected: 0,
        expandedId: null,
        restoreScrollY: action.scrollY,
      };
    case 'next':
      if (!state.open || state.ids.length === 0) return state;
      return {
        ...state,
        selected: Math.min(state.ids.length - 1, state.selected + 1),
        expandedId: null,
      };
    case 'prev':
      if (!state.open || state.ids.length === 0) return state;
      return { ...state, selected: Math.max(0, state.selected - 1), expandedId: null };
    case 'select': {
      const i = state.ids.indexOf(action.id);
      return i < 0 ? state : { ...state, selected: i };
    }
    case 'toggle-expand': {
      const id = state.ids[state.selected] ?? null;
      if (!state.open || !id) return state;
      return { ...state, expandedId: state.expandedId === id ? null : id };
    }
    case 'exit':
      return { ...initialShowAll };
  }
}

export function selectedId(state: ShowAllState): string | null {
  return state.ids[state.selected] ?? null;
}

/**
 * Single-key shortcuts never fire while the user types in the host page (AC-F6.3).
 * Accepts the event target and reads only tag and editability.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== 'string') return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    return ![
      'button',
      'checkbox',
      'radio',
      'submit',
      'reset',
      'range',
      'color',
      'file',
      'image',
    ].includes(type);
  }
  if (el.isContentEditable) return true;
  const ce = el.getAttribute('contenteditable');
  return ce === '' || ce === 'true' || ce === 'plaintext-only';
}

export type ShowAllKey = 'next' | 'prev' | 'toggle-expand' | 'exit' | 'help' | null;

export function keyToAction(key: string, target: EventTarget | null): ShowAllKey {
  if (isTypingTarget(target)) return null;
  switch (key) {
    case 'j':
    case 'J':
    case 'ArrowDown':
      return 'next';
    case 'k':
    case 'K':
    case 'ArrowUp':
      return 'prev';
    case 'Enter':
      return 'toggle-expand';
    case 'Escape':
      return 'exit';
    case '?':
      return 'help';
    default:
      return null;
  }
}
