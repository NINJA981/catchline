// Money parsing shared by the extractor and the rollup.

/** Source for a money amount inside other regexes: "$35", "$1,299.99", "US$ 5", "€9,99", "£4". */
export const MONEY = String.raw`(?:US\s?)?[$€£]\s?(?:\d{1,3}(?:[,.]\d{3})+|\d+)(?:[.,]\d{1,2})?(?!\d)`;

const CURRENCY: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP' };

export interface ParsedMoney {
  value: number;
  currency: string;
  /** Normalized display text: "$35", "$1,299.99". */
  text: string;
}

export function parseMoney(raw: string): ParsedMoney | null {
  const m = /([$€£])\s?((?:\d{1,3}(?:[,.]\d{3})+|\d+)(?:[.,]\d{1,2})?)(?!\d)/.exec(raw);
  if (!m?.[1] || !m[2]) return null;
  const symbol = m[1];
  const digits = m[2];
  let value: number;
  if (symbol === '€' && /,\d{1,2}$/.test(digits)) {
    value = Number(digits.replace(/\./g, '').replace(',', '.'));
  } else {
    value = Number(digits.replace(/,/g, ''));
  }
  if (!Number.isFinite(value)) return null;
  return { value, currency: CURRENCY[symbol] ?? 'USD', text: `${symbol}${digits}` };
}

/** "$35", "$1,234.50", "€9.99"; whole amounts drop the decimals. */
export function formatMoney(value: number, currency: string): string {
  const symbol = Object.entries(CURRENCY).find(([, c]) => c === currency)?.[0] ?? '$';
  const whole = Number.isInteger(value);
  const s = value.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${s}`;
}

/** "/mo", "/yr" or "" from a period word. */
export function periodSuffix(word: string | undefined): string {
  if (!word) return '';
  const w = word.toLowerCase();
  if (/^(mo|mos|month|months|monthly)$/.test(w)) return '/mo';
  if (/^(yr|yrs|year|years|annually|annual)$/.test(w)) return '/yr';
  if (/^(wk|week|weekly)$/.test(w)) return '/wk';
  return '';
}
