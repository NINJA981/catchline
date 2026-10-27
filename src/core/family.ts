// Page family guess (ADR §2 family.ts): vocabulary counts over the page text. Used to weight
// extractor rules, never to hide a chip.

import { FAMILIES, type Family } from './types';

const VOCAB: Record<Family, RegExp> = {
  carrier:
    /\b(unlimited (?:talk|text|data|plan)|5g|4g lte|wireless|carrier|hotspot|per line|lines?|data plan|gb|mbps|gbps|broadband|fiber|internet|activation|port[- ]in|trade[- ]in|esim|sim card|prepaid|postpaid|autopay)\b/gi,
  bank: /\b(apr|apy|credit card|balance transfer|cardmember|card member|annual fee|checking account|savings account|fdic|direct deposit|intro(?:ductory)? apr|cash back|welcome bonus|bonus points|credit limit|variable rate|purchases)\b/gi,
  retail:
    /\b(% off|clearance|free shipping|add to cart|checkout|coupon|promo code|in-store|in stock|sale ends|doorbuster|rewards members?|bag|cart|order|exclusions apply|select styles|while supplies last)\b/gi,
  streaming:
    /\b(stream(?:ing)?|watch|episodes?|movies|series|originals|with ads|ad-free|ad-supported|subscribers?|screens? at a time|4k|hdr|free trial|cancel anytime|live tv)\b/gi,
  saas: /\b(per (?:user|seat)|seats?|workspace|team plan|enterprise|api|integrations?|billed (?:annually|monthly)|sso|saml|projects|storage|admin|collaborat\w+|free tier|starter|pro plan|business plan)\b/gi,
  travel:
    /\b(fares?|flights?|round[- ]trip|one[- ]way|each way|airline|depart\w*|destinations?|baggage|bag fees|hotel|resort|nights?|double occupancy|cruise|booking|travel(?:ers)?|blackout dates|routes?)\b/gi,
};

export interface FamilyGuess {
  family: Family | 'unknown';
  scores: Record<Family, number>;
}

/** Highest vocabulary count wins if it has at least `min` hits and leads the runner-up by 20%. */
export function guessFamily(text: string, min = 3): FamilyGuess {
  const sample = text.length > 200_000 ? text.slice(0, 200_000) : text;
  const scores = {} as Record<Family, number>;
  for (const f of FAMILIES) {
    VOCAB[f].lastIndex = 0;
    scores[f] = sample.match(VOCAB[f])?.length ?? 0;
  }
  const ranked = [...FAMILIES].sort((a, b) => scores[b] - scores[a]);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || !second) return { family: 'unknown', scores };
  const best = scores[top];
  if (best < min || best < scores[second] * 1.2) return { family: 'unknown', scores };
  return { family: top, scores };
}
