// Catchline engine: the one entry module the extension and the web app (site/) both import.
//
// Everything reachable from here is plain TypeScript: DOM in, data out. No chrome.* / browser.*
// APIs, no WXT imports, no network, no globals (window is always passed in). ESLint enforces this
// for src/core/** (eslint.config.js), and tests/unit/core-boundary.test.ts checks the sources.

// Domain types.
export type {
  Catch,
  Chip,
  ChipKind,
  Family,
  FootnoteBlock,
  FootnoteSource,
  Marker,
  MarkerGlyph,
  Match,
  MatchSignal,
  StyleOracle,
  SymbolGlyph,
  TabRollup,
  TextAnchor,
} from './types';
export { CHIP_KINDS, FAMILIES } from './types';

// One page scan: markers -> footnotes -> matches -> chips.
export { analyze, type Analysis, type AnalyzeOptions } from './analyze';
export { scanMarkers, classifyRun, type ScanMarkersOptions } from './scan/markers';
export { collectCandidates, type Candidate, type CandidateIndex } from './match/candidates';
export { matchMarkers, type MatchedFootnote, type MatchResult } from './match/index';
export {
  MATCH_THRESHOLD,
  MATCHED_THRESHOLD,
  confidenceLevel,
  scoreCandidate,
  type ConfidenceLevel,
} from './match/score';
export { chooseSentence, indexSentences } from './match/sentence';
export { extractChips, RULES, type ExtractOptions } from './extract/index';
export { formatMoney, parseMoney, type ParsedMoney } from './extract/money';
export { guessFamily, type FamilyGuess } from './family';

// Layout reads, injectable.
export {
  createComputedStyleOracle,
  createInlineStyleOracle,
  type ComputedStyleSource,
} from './style';

// Rollup, badge and copy.
export {
  BADGE_MAX_CHARS,
  badgeText,
  badgeTitle,
  buildRollup,
  isTabRollup,
  rollupSummary,
} from './rollup';
export { expanderLabel, pageOffsetLabel, shareFileName } from './format';
export { orderSummaries, toCatchSummary, type CatchSummary } from './summary';

// Text and ids.
export {
  collapseWhitespace,
  splitSentences,
  tokenize,
  tokenOverlap,
  truncate,
  wordCount,
} from './text';
export { domPath, fnv1a, shortId } from './hash';
export { hostnameOf, isHostDisabled, isRestrictedUrl, normalizeHost, truncateMiddle } from './url';

// Settings schema (storage lives in src/storage, behind the extension adapter).
export {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  sanitizeSettings,
  type Settings,
} from './settings';

// UI state machines (pure reducers and view derivations).
export {
  cardState,
  glyphDisplay,
  likelyReason,
  MAX_VISIBLE_CHIPS,
  visibleChips,
  type CardState,
} from './state/card';
export { derivePopupView, SKELETON_DELAY_MS, type PopupInput, type PopupView } from './state/popup';
export {
  initialShowAll,
  isTypingTarget,
  keyToAction,
  selectedId,
  showAllReducer,
  type ShowAllAction,
  type ShowAllKey,
  type ShowAllState,
} from './state/show-all';

// Overlay math and copy shared by the extension and the web app.
export { splitFigures, type FigureSegment } from './figures';
export { rebaseSpans, segmentText, type TextSegment } from './highlight';
export {
  CARD_GAP,
  CARD_WIDTH,
  STICKY_GAP,
  VIEWPORT_MARGIN,
  bezierPath,
  bezierPoint,
  cardDockPoint,
  clamp,
  flightScale,
  flightStart,
  markerExitPoint,
  placeCard,
  rectCenter,
  rectHeight,
  rectWidth,
  tetherCurve,
  type Bezier,
  type PlaceInput,
  type Placement,
  type Point,
  type Rect,
  type Side,
  type Size,
} from './geometry';
export {
  REDUCED,
  SHORT,
  SIGNATURE,
  chipStartMs,
  chooseVariant,
  cubicBezierEase,
  type MotionVariant,
} from './timeline';
export {
  SHARE,
  formatShareDate,
  layoutShare,
  wrapLines,
  type ChipBox,
  type Face,
  type Line,
  type Measure,
  type ShareInput,
  type ShareLayout,
} from './share';
export { ledgerRows, type LedgerCategory, type LedgerRow } from './state/ledger';
