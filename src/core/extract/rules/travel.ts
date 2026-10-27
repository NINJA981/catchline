// Airline and travel vocabulary (SPEC §4.1): one-way vs round trip, taxes and fees excluded, bag
// fees, non-refundable, per person based on double occupancy, blackout dates, select routes.

import { MONEY, parseMoney } from '../money';
import { rule, type Rule } from '../rule';

export const TRAVEL_RULES: Rule[] = [
  rule({
    id: 'travel.one-way',
    kind: 'requirement',
    family: 'travel',
    re: /\b(?:fares?\s+(?:are|is|shown are)\s+)?(?:each way|one[- ]way)\b(?:\s+(?:fares?|travel|only))?/gi,
    build: () => ({ label: 'One-way fare' }),
  }),
  rule({
    id: 'travel.round-trip-required',
    kind: 'requirement',
    family: 'travel',
    priority: 2,
    re: /\b(?:requires?|with)\s+(?:a\s+)?round[- ]trip\s+(?:purchase|ticket|travel)?|\bround[- ]trip\s+(?:purchase|travel)\s+(?:is\s+)?required\b|\bbased on (?:a\s+)?round[- ]trip\s+(?:purchase|travel)\b/gi,
    build: () => ({ label: 'Round trip required' }),
  }),
  rule({
    id: 'travel.bag-fee-amount',
    kind: 'money',
    family: 'travel',
    priority: 3,
    re: new RegExp(
      String.raw`\b(?:first\s+|1st\s+|second\s+|2nd\s+)?(?:checked\s+)?bag(?:gage)?\s+fees?\s+(?:start(?:ing)? at|from|of|are|is)\s+(${MONEY})|(${MONEY})\s+(?:for\s+(?:the\s+)?(?:first|1st|second|2nd)\s+)?(?:checked\s+)?bag(?:gage)?\b|\b(?:first|1st|second|2nd)\s+checked\s+bag\s+(?:is\s+|costs\s+|:\s*)?(${MONEY})`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? m[2] ?? m[3] ?? '');
      if (!money) return null;
      return { label: `${money.text} bag fee`, value: money.value, unit: money.currency };
    },
  }),
  rule({
    id: 'travel.bag-fees-extra',
    kind: 'exclusion',
    family: 'travel',
    re: /\b(?:checked\s+)?bag(?:gage)?\s+fees?\s+(?:may\s+)?(?:apply|are extra|not included|additional)\b|\bchecked bags?\s+(?:are\s+)?(?:not included|extra|cost extra)\b|\b(?:does not|doesn't) include (?:a\s+)?(?:checked|carry-on) bags?\b/gi,
    build: () => ({ label: 'Bag fees extra' }),
  }),
  rule({
    id: 'travel.non-refundable',
    kind: 'exclusion',
    family: 'travel',
    re: /\bnon[- ]?refundable\b|\bno refunds?\b|\bnot refundable\b/gi,
    build: () => ({ label: 'Non-refundable' }),
  }),
  rule({
    id: 'travel.change-fees',
    kind: 'exclusion',
    family: 'travel',
    re: /\bno (?:changes|cancellations)(?: or (?:changes|cancellations))?\b|\bchanges? (?:are )?not (?:permitted|allowed)\b|\bbasic economy\b/gi,
    build: (m) =>
      /basic economy/i.test(m[0]) ? { label: 'Basic economy' } : { label: 'No changes allowed' },
  }),
  rule({
    id: 'travel.double-occupancy',
    kind: 'requirement',
    family: 'travel',
    priority: 2,
    re: /\bper\s+person,?\s+(?:based on|based upon|at)\s+double\s+occupancy\b|\bbased on double occupancy\b|\bdouble occupancy\b/gi,
    build: () => ({ label: 'Per person, double occupancy' }),
  }),
  rule({
    id: 'travel.per-person',
    kind: 'requirement',
    family: 'travel',
    re: /\bper\s+(?:person|traveler|passenger|guest)\b/gi,
    build: () => ({ label: 'Price per person' }),
  }),
  rule({
    id: 'travel.blackout',
    kind: 'exclusion',
    family: 'travel',
    re: /\bblackout\s+dates?(?:\s+(?:and\s+restrictions\s+)?(?:may\s+)?apply)?\b/gi,
    build: () => ({ label: 'Blackout dates apply' }),
  }),
  rule({
    id: 'travel.select-routes',
    kind: 'exclusion',
    family: 'travel',
    re: /\b(?:on\s+)?select(?:ed)?\s+(routes|markets|flights|dates|destinations|cities|departures|hotels|properties|nights)\b|\blimited\s+(?:seats|availability|inventory)\b/gi,
    build: (m) =>
      m[1] ? { label: `Select ${m[1].toLowerCase()} only` } : { label: 'Limited seats' },
  }),
  rule({
    id: 'travel.advance-purchase',
    kind: 'requirement',
    family: 'travel',
    priority: 1,
    re: /\b(\d{1,2})[- ]day\s+advance\s+(?:purchase|booking)\b|\b(?:purchase|book(?:ing)?)\s+(?:at least\s+)?(\d{1,2})\s+days\s+(?:in advance|before departure|ahead)\b/gi,
    build: (m) => ({ label: `Book ${String(Number(m[1] ?? m[2]))} days ahead` }),
  }),
  rule({
    id: 'travel.min-stay',
    kind: 'requirement',
    family: 'travel',
    re: /\b(?:minimum|min\.?)\s+(?:stay\s+(?:of\s+)?)?(\d{1,2})[- ]nights?(?:\s+stay)?\b|\b(\d{1,2})[- ]night\s+minimum\b|\bstay\s+must\s+be\s+at\s+least\s+(\d{1,2})\s+nights?\b|\bsaturday[- ]night stay\b/gi,
    build: (m) => {
      if (/saturday/i.test(m[0])) return { label: 'Saturday night stay required' };
      const n = Number(m[1] ?? m[2] ?? m[3]);
      return { label: `Minimum ${String(n)} night${n === 1 ? '' : 's'}` };
    },
  }),
  rule({
    id: 'travel.resort-fee',
    kind: 'money',
    family: 'travel',
    priority: 3,
    re: new RegExp(
      String.raw`(${MONEY})\s*(?:\/|per)\s*night\s+(resort|destination|amenity|facility)\s+fee|\b(resort|destination|amenity|facility)\s+fee\s+(?:of\s+)?(${MONEY})\s*(?:\/|per)\s*night`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? m[4] ?? '');
      if (!money) return null;
      const word = (m[2] ?? m[3] ?? 'resort').toLowerCase();
      return {
        label: `${money.text}/night ${word} fee`,
        value: money.value,
        unit: `${money.currency}/night`,
      };
    },
  }),
  rule({
    id: 'travel.taxes-not-included-fare',
    kind: 'exclusion',
    family: 'travel',
    priority: 2,
    re: /\b(?:fares?|prices?|rates?)\s+(?:do not|don't)\s+include\s+(?:government\s+)?(?:taxes|fees)\b|\btaxes,?\s+fees\s+and\s+(?:carrier[- ])?(?:charges|surcharges)\s+(?:are\s+)?(?:extra|additional)\b|\bexcludes?\s+(?:government\s+)?taxes\s+and\s+fees\b|\b(?:September 11th|9\/11) security fee\b|\bup to\s+\$\d+(?:\.\d{2})?\s+in\s+(?:government\s+)?taxes\b/gi,
    build: () => ({ label: 'Taxes and fees extra' }),
  }),
];
