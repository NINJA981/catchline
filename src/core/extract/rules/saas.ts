// SaaS pricing vocabulary (SPEC §4.1): billed annually, per seat, minimum seats, usage caps,
// overage price, price after N months.

import { MONEY, parseMoney, periodSuffix } from '../money';
import { rule, type Rule } from '../rule';

// "1,000 API calls", "10k requests", "GB", "seat".
const USAGE_UNIT = String.raw`(?:[\d,.]+\s?[kKmM]?\s+)?(?:API calls|[A-Za-z]+)`;

export const SAAS_RULES: Rule[] = [
  rule({
    id: 'saas.billed-annually',
    kind: 'requirement',
    family: 'saas',
    priority: 1,
    re: /\b(?:when\s+)?(?:billed|paid|charged)\s+(?:annually|yearly|per year|once a year|upfront annually)\b|\bannual\s+(?:billing|plan|commitment|contract|prepayment)\s*(?:required|only)?\b|\bwith an annual (?:plan|subscription|commitment)\b/gi,
    build: (m) => ({
      label: /commitment|contract/i.test(m[0]) ? 'Annual commitment' : 'Billed annually',
    }),
  }),
  rule({
    id: 'saas.per-seat',
    kind: 'requirement',
    family: 'saas',
    re: /\bper\s+(user|seat|member|editor|active user|agent|license|host)\b|\/\s*(user|seat|member|editor)\b/gi,
    build: (m) => {
      const what = (m[1] ?? m[2] ?? 'user').toLowerCase();
      return { label: `Priced per ${what}` };
    },
  }),
  rule({
    id: 'saas.min-seats',
    kind: 'requirement',
    family: 'saas',
    priority: 2,
    re: /\b(?:minimum|min\.?)\s+(?:of\s+)?(\d{1,4})\s+(seats|users|licenses|members|editors)\b|\b(\d{1,4})[- ](seat|user|license)\s+minimum\b|\bstarts? at\s+(\d{1,4})\s+(seats|users)\b/gi,
    build: (m) => {
      const n = Number(m[1] ?? m[3] ?? m[5]);
      const what = (m[2] ?? m[4] ?? m[6] ?? 'seats').toLowerCase().replace(/s$/, '');
      return { label: `Minimum ${String(n)} ${what}s` };
    },
  }),
  rule({
    id: 'saas.usage-cap',
    kind: 'exclusion',
    family: 'saas',
    re: /\b(?:up to|limited to|max(?:imum)? of|capped at|includes?)\s+([\d,.]+\s?[kKmM]?)\s+(API calls|requests|calls|projects|users|GB|TB|credits|minutes|messages|runs|builds|seats|contacts|emails|events|tasks|automations|records|pageviews|page views|sessions|tokens)(?![a-z])(?:\s*(?:\/|per|a|each)\s*(month|mo|day|year|user|minute|min|hour|second))?/gi,
    build: (m) => {
      const n = (m[1] ?? '').trim();
      const unit = (m[2] ?? '')
        .toLowerCase()
        .replace('api calls', 'API calls')
        .replace('gb', 'GB')
        .replace('tb', 'TB');
      const period = (m[3] ?? '').toLowerCase();
      const short: Record<string, string> = {
        month: 'mo',
        minute: 'min',
        hour: 'hr',
        second: 'sec',
      };
      const per = period ? `/${short[period] ?? period}` : '';
      return { label: `Up to ${n} ${unit}${per}` };
    },
  }),
  rule({
    id: 'saas.overage',
    kind: 'money',
    family: 'saas',
    priority: 3,
    re: new RegExp(
      String.raw`\b(?:overages?|additional usage|extra usage|usage above (?:the|your) (?:limit|plan))\s+(?:is\s+|are\s+)?(?:billed\s+|charged\s+)?(?:at\s+)?(${MONEY})(?:\s*(?:per|\/|for each|each)\s*(?:additional\s+|extra\s+)?(${USAGE_UNIT}))?|(${MONEY})\s*(?:per|\/|for each)\s+(?:additional|extra)\s+(${USAGE_UNIT})`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? m[3] ?? '');
      if (!money) return null;
      const per = (m[2] ?? m[4] ?? '').trim().replace(/\s+/g, ' ');
      return {
        label: per ? `${money.text} per extra ${per}` : `${money.text} overage`,
        value: money.value,
        // A rate, not a one-time amount: kept out of the rollup total.
        unit: `${money.currency}/unit`,
      };
    },
  }),
  rule({
    id: 'saas.extra-unit',
    kind: 'money',
    family: 'saas',
    priority: 3,
    re: new RegExp(
      String.raw`\b(?:extra|additional)\s+([a-z]+)\s+(?:cost|costs|are|is)\s+(${MONEY})\s*(?:\/\s*(mo|month|yr|year)|per\s+(month|year))?(?:\s+each)?`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[2] ?? '');
      if (!money) return null;
      const noun = (m[1] ?? 'unit').toLowerCase().replace(/s$/, '');
      const period = periodSuffix(m[3] ?? m[4]);
      return {
        label: `${money.text}${period} per extra ${noun}`,
        value: money.value,
        unit: `${money.currency}/unit`,
      };
    },
  }),
  rule({
    id: 'saas.monthly-price-higher',
    kind: 'renewal',
    family: 'saas',
    priority: 2,
    re: new RegExp(
      String.raw`(${MONEY})\s*(?:\/|per)\s*(?:user\s*\/?\s*)?(?:mo|month)\s+(?:if|when)\s+billed\s+monthly|\bbilled\s+monthly\s+(?:at|for)\s+(${MONEY})`,
      'gi',
    ),
    build: (m) => {
      const money = parseMoney(m[1] ?? m[2] ?? '');
      if (!money) return null;
      return {
        label: `${money.text}/mo if billed monthly`,
        value: money.value,
        unit: `${money.currency}/mo`,
      };
    },
  }),
  rule({
    id: 'saas.no-refunds',
    kind: 'exclusion',
    family: 'saas',
    re: /\bno (?:pro[- ]?rated )?refunds?\b|\bnon[- ]refundable\b|\bnot (?:pro[- ]?rated|refundable)\b/gi,
    build: () => ({ label: 'No refunds' }),
  }),
  rule({
    id: 'saas.intro-price',
    kind: 'renewal',
    family: 'saas',
    re: /\b(?:introductory|promotional|launch|first[- ]year)\s+(?:price|pricing|discount|rate)\b/gi,
    build: () => ({ label: 'Introductory price' }),
  }),
];
