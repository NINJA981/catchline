// Text utilities shared by the scanner, matcher and extractor. Pure functions.

const WS = /\s+/g;

export function collapseWhitespace(text: string): string {
  return text.replace(WS, ' ').trim();
}

export function wordCount(text: string): number {
  const t = collapseWhitespace(text);
  if (!t) return 0;
  return t.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Trim to max chars on a word boundary, adding a real ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

// Abbreviations that never end a sentence (titles, Latin, "approx.").
const STRICT_ABBREVIATIONS = new Set([
  'e.g',
  'i.e',
  'approx',
  'incl',
  'excl',
  'vs',
  'mr',
  'mrs',
  'ms',
  'dr',
  'st',
  'no',
  'nos',
]);

// Abbreviations that end a sentence only when an uppercase word follows ("$35/mo. Autopay ...").
// Followed by a digit they are units ("Approx. 5 GB", "mo. 36"): no split.
const UNIT_ABBREVIATIONS = new Set([
  'mo',
  'mos',
  'yr',
  'yrs',
  'min',
  'mins',
  'hr',
  'hrs',
  'oz',
  'lb',
  'lbs',
  'ft',
  'sq',
  'pt',
  'pts',
]);

export interface SentenceSpan {
  start: number;
  end: number;
  text: string;
}

const SENTENCE_END = /[.!?]+["')\]]*(?=\s+|$)/g;

/**
 * Split text into sentences with character spans into the original string.
 * Handles decimals ("$4.99"), common abbreviations ("Approx.", "mo.") and initialisms ("U.S.").
 */
export function splitSentences(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let start = 0;
  SENTENCE_END.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SENTENCE_END.exec(text))) {
    const endIdx = m.index + m[0].length;
    // Word before the terminator.
    const before = text.slice(start, m.index);
    const wordMatch = /([A-Za-z.]+)$/.exec(before);
    const word = wordMatch?.[1]?.toLowerCase() ?? '';
    const rest = text.slice(endIdx).trimStart();
    const plainPeriod = m[0] === '.';
    if (plainPeriod && STRICT_ABBREVIATIONS.has(word)) continue;
    if (plainPeriod && UNIT_ABBREVIATIONS.has(word) && /^\d/.test(rest)) continue;
    // Initialisms ("U.S.") or any period followed by a lowercase word: not an end.
    if (/^[a-z]/.test(rest)) continue;
    pushSpan(spans, text, start, endIdx);
    start = endIdx;
  }
  pushSpan(spans, text, start, text.length);
  return spans;
}

function pushSpan(spans: SentenceSpan[], text: string, from: number, to: number): void {
  let s = from;
  let e = to;
  while (s < e && /\s/.test(text.charAt(s))) s++;
  while (e > s && /\s/.test(text.charAt(e - 1))) e--;
  if (e > s) spans.push({ start: s, end: e, text: text.slice(s, e) });
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'our',
  'the',
  'this',
  'that',
  'to',
  'with',
  'you',
  'your',
  'will',
  'may',
  'all',
  'any',
  'per',
  'not',
  'get',
  'up',
]);

const UNIT_ALIASES: Record<string, string> = {
  mo: 'month',
  mos: 'month',
  month: 'month',
  monthly: 'month',
  yr: 'year',
  yrs: 'year',
  year: 'year',
  annual: 'year',
  annually: 'year',
  gb: 'gb',
  mbps: 'mbps',
  gbps: 'gbps',
  apr: 'apr',
  apy: 'apy',
  day: 'day',
  days: 'day',
};

export interface Token {
  value: string;
  /** Numbers and units weigh 2x in overlap (ADR §4.4). */
  weight: number;
}

/** Lowercased content tokens; numbers keep their digits ("$35.00" -> "35"), units normalize. */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const raw = text.toLowerCase().match(/\d[\d,]*(?:\.\d+)?|[\p{L}]+/gu) ?? [];
  for (const r of raw) {
    if (/^\d/.test(r)) {
      const num = r.replace(/,/g, '').replace(/\.0+$/, '');
      out.push({ value: num, weight: 2 });
      continue;
    }
    const stem = r.length > 4 && r.endsWith('s') && !r.endsWith('ss') ? r.slice(0, -1) : r;
    // Units weigh double in both forms: "month" and "months".
    const unit = UNIT_ALIASES[r] ?? UNIT_ALIASES[stem];
    if (unit) {
      out.push({ value: unit, weight: 2 });
      continue;
    }
    if (STOPWORDS.has(r) || r.length < 2) continue;
    out.push({ value: stem, weight: 1 });
  }
  return out;
}

/**
 * Weighted share of the claim's tokens found in the candidate, 0..1.
 * Optional idf map down-weights tokens that appear in many candidate sentences.
 */
export function tokenOverlap(
  claim: readonly Token[],
  candidate: readonly Token[],
  idf?: ReadonlyMap<string, number>,
): number {
  if (claim.length === 0 || candidate.length === 0) return 0;
  const have = new Set(candidate.map((t) => t.value));
  const seen = new Set<string>();
  let total = 0;
  let hit = 0;
  for (const t of claim) {
    if (seen.has(t.value)) continue;
    seen.add(t.value);
    const w = t.weight * (idf?.get(t.value) ?? 1);
    total += w;
    if (have.has(t.value)) hit += w;
  }
  return total === 0 ? 0 : hit / total;
}
