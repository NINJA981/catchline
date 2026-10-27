// Shopping and retail vocabulary (SPEC §4.1): minimum order, excluded items or brands, member-only,
// one per customer, while supplies last, in-store only, end date.

import { MONEY, parseMoney } from '../money';
import { rule, type Rule } from '../rule';

export const RETAIL_RULES: Rule[] = [
  rule({
    id: 'retail.min-order',
    kind: 'requirement',
    family: 'retail',
    priority: 2,
    re: new RegExp(
      String.raw`\b(?:on\s+)?(?:orders?|purchases?|subtotals?)\s+(?:of\s+)?(?:over|above|of at least|totaling|of|exceeding|\$?\d+\+?\s+or more)\s+(${MONEY})(\+)?|\b(?:minimum|min\.)\s+(?:order|purchase|spend|subtotal)\s+(?:of\s+|is\s+)?(${MONEY})|(${MONEY})\+?\s+(?:minimum|min\.)\s+(?:order|purchase|spend)|\bwhen you spend\s+(${MONEY})(?:\s+or more)?|\bwith\s+(?:a|any)\s+(${MONEY})\+?\s+purchase|\b(?:orders?|purchases?)\s+of\s+(${MONEY})\+`,
      'gi',
    ),
    build: (m) => {
      const raw = m[1] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7] ?? '';
      const money = parseMoney(raw);
      if (!money) return null;
      return { label: `Orders of ${money.text}+` };
    },
  }),
  rule({
    id: 'retail.members-only',
    kind: 'requirement',
    family: 'retail',
    re: /\b(?:members?|loyalty members?|rewards members?|cardholders?)\s+only\b|\bmember[- ]exclusive\b|\bfor\s+(?:\w+\s+)?(?:rewards\s+)?members\b|\bwith\s+(?:a\s+)?(?:paid\s+)?(?:\w+\s+)?membership\b|\brequires?\s+(?:a\s+)?(?:\w+\s+)?membership\b/gi,
    build: () => ({ label: 'Members only' }),
  }),
  rule({
    id: 'retail.select-items',
    kind: 'exclusion',
    family: 'retail',
    re: /\b(?:on\s+)?select(?:ed)?\s+(items|styles|products|brands|merchandise|colors|sizes|models)\b|\bparticipating\s+(brands|items|stores|locations|retailers)\b/gi,
    build: (m) => ({ label: `Select ${(m[1] ?? m[2] ?? 'items').toLowerCase()} only` }),
  }),
  rule({
    id: 'retail.final-sale',
    kind: 'exclusion',
    family: 'retail',
    // "Excludes final sale items" is an exclusion of those items, not a final-sale term.
    re: /\bfinal sale\b(?!\s+(?:items?|merchandise|styles?|products?))|\bno returns?(?: or exchanges?)?\b|\bnot eligible for returns?\b/gi,
    build: (m) => ({ label: /final sale/i.test(m[0]) ? 'Final sale' : 'No returns' }),
  }),
  rule({
    id: 'retail.price-adjustments',
    kind: 'exclusion',
    family: 'retail',
    re: /\b(?:no|not eligible for)\s+price\s+adjustments?\b|\bnot valid on (?:prior|previous) purchases\b/gi,
    build: (m) => ({
      label: /prior|previous/i.test(m[0]) ? 'Not valid on prior purchases' : 'No price adjustments',
    }),
  }),
  rule({
    id: 'retail.shipping-conditions',
    kind: 'exclusion',
    family: 'retail',
    re: /\b(?:standard|ground)\s+shipping\s+only\b|\bcontiguous\s+(?:U\.S\.|US|United States)\b|\b(?:excludes?|not available (?:to|for))\s+(?:Alaska|Hawaii|APO)/gi,
    build: (m) =>
      /standard|ground/i.test(m[0])
        ? { label: 'Standard shipping only' }
        : { label: 'Contiguous US only' },
  }),
  rule({
    id: 'retail.discount-cap',
    kind: 'exclusion',
    family: 'retail',
    priority: 1,
    re: new RegExp(
      String.raw`\b(?:max(?:imum)?|up to a maximum)\s+(?:discount|savings?)\s+(?:of\s+)?(${MONEY})|\bdiscount\s+(?:capped|limited)\s+(?:at|to)\s+(${MONEY})`,
      'gi',
    ),
    build: (m) => ({ label: `Discount capped at ${parseMoney(m[1] ?? m[2] ?? '')?.text ?? ''}` }),
  }),
  rule({
    id: 'retail.restocking',
    kind: 'money',
    family: 'retail',
    priority: 3,
    re: /\b(\d{1,2})%\s+restocking\s+fee\b/gi,
    build: (m) => ({ label: `${m[1] ?? ''}% restocking fee` }),
  }),
];
